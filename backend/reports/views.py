from datetime import date
from decimal import Decimal

from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from invoicing.models import Invoice, InvoiceLineItem, PaymentRecord

# There's no models.py content in this app — a "report" isn't a thing that
# gets stored in the database, it's just numbers CALCULATED from Invoice,
# InvoiceLineItem, and PaymentRecord rows that already exist. So this app
# is just views.

CENTS = Decimal("0.01")

# Which invoice statuses actually represent real, collected money — used
# by every report below except revenue/refunds themselves (those stay
# PaymentRecord-based, see ProfitLossView). REFUNDED is included, not
# excluded: PaymentRecordSerializer.create() flips an invoice to
# "refunded" on ANY refund, even a small goodwill one on an otherwise
# fully-paid invoice — filtering to just PAID would silently drop that
# whole invoice's cost/tax/by-item numbers while revenue/refunds still
# counted it correctly, making the reports internally inconsistent. The
# tradeoff: a fully-refunded invoice still counts 100% toward
# cost/tax/by-item here (there's no per-line refund proration in the
# data model) — a deliberate v1 simplification, not an oversight.
QUALIFYING_STATUSES = [Invoice.STATUS_PAID, Invoice.STATUS_REFUNDED]


def _default_date_range(request):
    start = request.query_params.get("start", date.today().replace(month=1, day=1))
    end = request.query_params.get("end", date.today())
    return start, end


def _qualifying_invoices(request, start, end):
    # The shared basis for cost/tax/by-item/by-client below: invoices
    # that actually collected money, filtered by ISSUED date rather than
    # payment date. Payment-date filtering would double-count an
    # invoice's full cost across two reporting periods if it's paid via
    # a deposit + balance in different months (revenue itself avoids
    # this because it sums payment AMOUNTS, not gated invoice totals).
    # Since every unpaid invoice auto-voids within 24h in this app
    # (Invoice.sync_void_status()), issued-date and payment-date are
    # almost always the same period in practice anyway.
    return Invoice.objects.for_account(request.user).filter(
        status__in=QUALIFYING_STATUSES, issued_date__gte=start, issued_date__lte=end
    )


class ProfitLossView(APIView):
    """
    GET /api/reports/profit-loss/?start=YYYY-MM-DD&end=YYYY-MM-DD

    A basic P&L report — built for tax filing, not full accountant-grade
    accrual accounting. "Revenue" here means cash actually recorded as
    received (via PaymentRecord), not invoices that were merely sent out.
    """

    def get(self, request):
        start, end = _default_date_range(request)

        payments = PaymentRecord.objects.for_account(request.user).filter(
            date_received__gte=start, date_received__lte=end
        )
        revenue = payments.filter(is_refund=False).aggregate(total=Sum("amount"))["total"] or 0
        refunds = payments.filter(is_refund=True).aggregate(total=Sum("amount"))["total"] or 0
        # `aggregate(...)["total"] or 0` — if there are zero matching rows,
        # Sum() returns None instead of 0, so the `or 0` fills in a sane
        # default instead of the response containing `null`.

        qualifying = _qualifying_invoices(request, start, end)

        # Only PAID/REFUNDED invoices' tax counts here — the old version
        # summed tax_amount across every invoice in the date range
        # regardless of status, overstating tax actually collected on
        # invoices that were never even paid.
        tax_collected = qualifying.aggregate(total=Sum("tax_amount"))["total"] or 0

        # Cost of Goods Sold: what it actually cost to deliver whatever
        # was sold on a qualifying invoice. Non-voided, non-refund lines
        # only — a refund line has no cost basis of its own (see
        # InvoiceLineItem.unit_cost), and the original sale's cost was
        # already incurred regardless of whether it was later refunded.
        # Small dataset for a solo/small business, so a plain Python sum
        # over the fetched rows (same style as _recompute_tax() in
        # invoicing/views.py) is simpler than a database-side expression
        # for what's really just quantity * unit_cost per row.
        cost_line_items = InvoiceLineItem.objects.filter(
            invoice__in=qualifying, is_voided=False, is_refund_line=False, unit_cost__isnull=False
        )
        cogs = sum((item.cost_amount() for item in cost_line_items), Decimal("0")).quantize(CENTS)

        net = revenue - refunds
        gross_profit = (net - cogs).quantize(CENTS)  # net - cogs is always a real Decimal even when net itself is the bare int 0 (zero payments this period)

        return Response(
            {
                "start": start,
                "end": end,
                "revenue": revenue,
                "refunds": refunds,
                "net": net,
                "cogs": cogs,
                "gross_profit": gross_profit,
                "tax_collected": tax_collected,
            }
        )


class RevenueByItemView(APIView):
    """
    GET /api/reports/revenue-by-item/?start=YYYY-MM-DD&end=YYYY-MM-DD

    Which services/products actually make money — grouped by Service,
    across every qualifying (paid/refunded) invoice in the date range.
    Sorted by revenue, highest first, so "what's actually worth scaling"
    is the first thing on screen.
    """

    def get(self, request):
        start, end = _default_date_range(request)
        qualifying = _qualifying_invoices(request, start, end)

        line_items = InvoiceLineItem.objects.filter(
            invoice__in=qualifying, is_voided=False, is_refund_line=False
        ).select_related("service")

        # Grouped by hand in Python rather than a database aggregate —
        # net_amount()'s flat-vs-percent discount branching isn't a
        # simple SQL expression, and this is a small dataset for a solo
        # business (same "loop it in Python" style already used
        # elsewhere in this app, e.g. invoicing/views.py's
        # _recompute_tax()).
        by_service = {}
        for item in line_items:
            row = by_service.setdefault(
                item.service_id,
                {"service": item.service_id, "name": item.service.name, "quantity": Decimal("0"), "revenue": Decimal("0"), "cost": Decimal("0"), "has_cost_data": False},
            )
            row["quantity"] += item.quantity
            row["revenue"] += item.net_amount()
            if item.unit_cost is not None:
                row["cost"] += item.cost_amount()
                row["has_cost_data"] = True

        results = []
        for row in by_service.values():
            has_cost = row.pop("has_cost_data")
            cost = row["cost"].quantize(CENTS) if has_cost else None
            revenue = row["revenue"].quantize(CENTS)
            results.append(
                {
                    "service": row["service"],
                    "name": row["name"],
                    "quantity": row["quantity"],
                    "revenue": revenue,
                    # null (not 0) when nobody's ever set a cost for this
                    # service — showing "$0 cost" would look like a real
                    # 100% margin instead of "we don't actually know."
                    "cost": cost,
                    "profit": (revenue - cost).quantize(CENTS) if cost is not None else None,
                }
            )
        results.sort(key=lambda r: r["revenue"], reverse=True)

        return Response({"start": start, "end": end, "results": results})


class RevenueByClientView(APIView):
    """
    GET /api/reports/revenue-by-client/?start=YYYY-MM-DD&end=YYYY-MM-DD

    Who's actually worth the most — grouped by Client, across every
    qualifying (paid/refunded) invoice in the date range. Sorted by
    revenue, highest first.
    """

    def get(self, request):
        start, end = _default_date_range(request)
        qualifying = _qualifying_invoices(request, start, end).select_related("client")

        by_client = {}
        for invoice in qualifying:
            row = by_client.setdefault(
                invoice.client_id,
                {"client": invoice.client_id, "name": invoice.client.full_name, "invoice_count": 0, "revenue": Decimal("0")},
            )
            row["invoice_count"] += 1
            row["revenue"] += invoice.total_due()

        results = [{**row, "revenue": row["revenue"].quantize(CENTS)} for row in by_client.values()]
        results.sort(key=lambda r: r["revenue"], reverse=True)

        return Response({"start": start, "end": end, "results": results})
