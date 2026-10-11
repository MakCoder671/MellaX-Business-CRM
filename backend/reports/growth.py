from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Max
from django.utils import timezone

from clients.models import Client
from invoicing.models import Invoice
from scheduling.models import Appointment

from .core import (
    account_timezone,
    cost_of_goods,
    expenses_between,
    money,
    revenue_between,
    revenue_ex_tax_between,
    sale_lines,
    sales_invoices_between,
    shift_one_year,
)

# ----------------------------------------------------------------------------
# The numbers behind the growth dashboard and the growth calculator. Each one is
# worked out the same way every time, and the help text on the page explains it.
# ----------------------------------------------------------------------------

LAPSED_DAYS_SHORT = 60
LAPSED_DAYS_LONG = 90
LAPSED_LIST_LIMIT = 25


def _pct(part, whole):
    if not whole:
        return Decimal("0.0")
    return (Decimal(part) * 100 / Decimal(whole)).quantize(Decimal("0.1"))


def _change(now, before):
    # Percent change from last year. None when last year was zero, because there's no baseline to
    # measure against. A percentage from a near-zero baseline would be meaningless, so the page says so instead.
    if not before or Decimal(before) <= 0:
        return None
    return float(((Decimal(now) - Decimal(before)) * 100 / Decimal(before)).quantize(Decimal("0.1")))


def period_metrics(account, start, end):
    """The core numbers for one date range. Used for the current period, last year, and every month."""
    gross, refunds, net = revenue_ex_tax_between(account, start, end)
    _, _, net_with_tax = revenue_between(account, start, end)
    invoices = sales_invoices_between(account, start, end)
    paid_invoices = invoices.count()
    served_ids = set(invoices.values_list("client_id", flat=True))

    # A returning client is someone served in this range who had a paid visit before it started.
    earlier_ids = set(
        Invoice.objects.for_account(account)
        .filter(status__in=["paid", "refunded"], issued_date__lt=start, client_id__in=served_ids)
        .values_list("client_id", flat=True)
    )
    returning = len(served_ids & earlier_ids)

    cogs = cost_of_goods(invoices)
    expenses = sum((e.amount for e in expenses_between(account, start, end)), Decimal("0"))

    return {
        "start": start,
        "end": end,
        "gross_received": gross,
        "refunds": refunds,
        "net_revenue": net,
        "sales_tax_collected": money(net_with_tax - net),
        "paid_invoices": paid_invoices,
        "average_ticket": money(net / paid_invoices) if paid_invoices else money(0),
        "clients_served": len(served_ids),
        "new_clients": Client.objects.for_account(account).filter(
            created_at__date__gte=start, created_at__date__lte=end
        ).count(),
        "returning_clients": returning,
        "returning_rate": _pct(returning, len(served_ids)),
        "cost_of_goods": cogs,
        # Products sold with no cost set. Their cost counts as zero, so profit can look higher than it is.
        "products_without_cost": sale_lines(invoices).filter(service__is_product=True, unit_cost__isnull=True).count(),
        "expenses": money(expenses),
        "profit": money(net - cogs - expenses),
    }


def _appointments_between(account, start, end):
    # Appointment times are shown in the business's own time zone, so a 9 AM booking stays on the right day.
    with timezone.override(account_timezone(account)):
        return Appointment.objects.for_account(account).filter(
            datetime__date__gte=start, datetime__date__lte=end
        )


def booking_health(account, start, end):
    """How many bookings were made, cancelled, or missed (no-shows) in the range."""
    appointments = _appointments_between(account, start, end)
    total = appointments.count()
    cancelled = appointments.filter(status=Appointment.STATUS_CANCELLED).count()
    no_shows = appointments.filter(status=Appointment.STATUS_NO_SHOW).count()
    return {
        "bookings": total,
        "cancelled": cancelled,
        "no_shows": no_shows,
        "cancelled_rate": _pct(cancelled, total),
        "no_show_rate": _pct(no_shows, total),
    }


def busiest_times(account, start, end):
    """Counts bookings by weekday and by hour, skipping cancelled ones."""
    tz = account_timezone(account)
    appointments = _appointments_between(account, start, end).exclude(status=Appointment.STATUS_CANCELLED)
    by_day = Counter()
    by_hour = Counter()
    for appointment in appointments:
        local = appointment.datetime.astimezone(tz)
        by_day[local.weekday()] += 1
        by_hour[local.hour] += 1
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return {
        "by_weekday": [{"day": days[i], "bookings": by_day.get(i, 0)} for i in range(7)],
        "by_hour": [{"hour": h, "bookings": by_hour[h]} for h in sorted(by_hour)],
    }


def top_services(account, start, end, limit=10):
    """The services that earned the most in the range, by net sales."""
    invoices = sales_invoices_between(account, start, end)
    totals = defaultdict(lambda: {"revenue": Decimal("0"), "count": 0})
    for line in sale_lines(invoices).select_related("service"):
        name = line.service.name
        totals[name]["revenue"] += line.net_amount()
        totals[name]["count"] += 1
    grand = sum((t["revenue"] for t in totals.values()), Decimal("0"))
    ranked = sorted(totals.items(), key=lambda kv: kv[1]["revenue"], reverse=True)[:limit]
    return [
        {
            "name": name,
            "revenue": money(t["revenue"]),
            "lines_sold": t["count"],
            "share": _pct(t["revenue"], grand),
        }
        for name, t in ranked
    ]


def lapsed_clients(account, today=None):
    """Clients whose last paid visit was a while ago. These are the ones to call back."""
    today = today or timezone.localdate()
    last_visits = (
        Invoice.objects.for_account(account)
        .filter(status__in=["paid", "refunded"])
        .values("client_id")
        .annotate(last_visit=Max("issued_date"))
    )
    short_cut = today - timedelta(days=LAPSED_DAYS_SHORT)
    long_cut = today - timedelta(days=LAPSED_DAYS_LONG)
    over_short = [row for row in last_visits if row["last_visit"] <= short_cut]
    over_long = [row for row in last_visits if row["last_visit"] <= long_cut]

    # The list shows the most recently lapsed first, so the easiest wins come at the top.
    ordered = sorted(over_short, key=lambda row: row["last_visit"], reverse=True)[:LAPSED_LIST_LIMIT]
    clients = {c.id: c for c in Client.objects.for_account(account).filter(id__in=[r["client_id"] for r in ordered])}
    visit_counts = dict(
        Invoice.objects.for_account(account)
        .filter(status__in=["paid", "refunded"], client_id__in=[r["client_id"] for r in ordered])
        .values("client_id")
        .annotate(count=Count("id"))
        .values_list("client_id", "count")
    )
    return {
        "over_60_days": len(over_short),
        "over_90_days": len(over_long),
        "list": [
            {
                "name": clients[row["client_id"]].full_name if row["client_id"] in clients else "Client",
                "client_id": row["client_id"],
                "last_visit": row["last_visit"],
                "days_since": (today - row["last_visit"]).days,
                "visits": visit_counts.get(row["client_id"], 0),
            }
            for row in ordered
        ],
    }


def growth_report(account, start, end):
    """Everything on the growth dashboard for one range, with last year alongside."""
    current = period_metrics(account, start, end)
    last_year_start, last_year_end = shift_one_year(start), shift_one_year(end)
    last_year = period_metrics(account, last_year_start, last_year_end)
    return {
        "current": current,
        "last_year": last_year,
        "changes": {
            "net_revenue": _change(current["net_revenue"], last_year["net_revenue"]),
            "average_ticket": _change(current["average_ticket"], last_year["average_ticket"]),
            "paid_invoices": _change(current["paid_invoices"], last_year["paid_invoices"]),
            "clients_served": _change(current["clients_served"], last_year["clients_served"]),
            "profit": _change(current["profit"], last_year["profit"]),
        },
        "bookings": booking_health(account, start, end),
        "busiest": busiest_times(account, start, end),
        "top_services": top_services(account, start, end),
        "lapsed": lapsed_clients(account),
    }


def month_bounds(year, month):
    start = date(year, month, 1)
    end = (date(year + (month == 12), (month % 12) + 1, 1)) - timedelta(days=1)
    return start, end


def monthly_series(account, months=12, today=None):
    """The last N calendar months, oldest first. The current month is marked as partial until it ends."""
    today = today or timezone.localdate()
    rows = []
    year, month = today.year, today.month
    for _ in range(months):
        start, end = month_bounds(year, month)
        metrics = period_metrics(account, start, end)
        metrics["label"] = start.strftime("%b %Y")
        metrics["is_partial"] = end >= today
        rows.append(metrics)
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(rows))
