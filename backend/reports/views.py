from datetime import date

from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from invoicing.models import Invoice, PaymentRecord

# There's no models.py content in this app — a "report" isn't a thing that
# gets stored in the database, it's just numbers CALCULATED from Invoice
# and PaymentRecord rows that already exist. So this app is just one view.


class ProfitLossView(APIView):
    """
    GET /api/reports/profit-loss/?start=YYYY-MM-DD&end=YYYY-MM-DD

    A basic P&L report — built for tax filing, not full accountant-grade
    accrual accounting. "Revenue" here means cash actually recorded as
    received (via PaymentRecord), not invoices that were merely sent out.
    """

    def get(self, request):
        # Default to "this calendar year so far" if no dates are given.
        start = request.query_params.get("start", date.today().replace(month=1, day=1))
        end = request.query_params.get("end", date.today())

        # .for_account(...) is the tenant-scoping helper from
        # common/models.py — makes sure we only ever total up THIS
        # account's own payments, never anyone else's.
        payments = PaymentRecord.objects.for_account(request.user).filter(
            date_received__gte=start, date_received__lte=end
        )
        revenue = payments.filter(is_refund=False).aggregate(total=Sum("amount"))["total"] or 0
        refunds = payments.filter(is_refund=True).aggregate(total=Sum("amount"))["total"] or 0
        # `aggregate(...)["total"] or 0` — if there are zero matching rows,
        # Sum() returns None instead of 0, so the `or 0` fills in a sane
        # default instead of the response containing `null`.

        tax_collected = (
            Invoice.objects.for_account(request.user)
            .filter(issued_date__gte=start, issued_date__lte=end)
            .aggregate(total=Sum("tax_amount"))["total"]
            or 0
        )

        return Response(
            {
                "start": start,
                "end": end,
                "revenue": revenue,
                "refunds": refunds,
                "net": revenue - refunds,
                "tax_collected": tax_collected,
            }
        )
