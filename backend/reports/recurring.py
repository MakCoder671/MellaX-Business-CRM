from datetime import date
from calendar import monthrange

from .models import Expense, RecurringExpense

# ----------------------------------------------------------------------------
# Adds the monthly entries for repeating expenses. It runs whenever expenses are
# read (the expenses list, the profit report, the growth numbers, the tax center,
# and the exports), so a repeating cost is always up to date without anyone
# pressing a button. Adding is safe to repeat: a month is only ever added once.
# ----------------------------------------------------------------------------


def _first_of(month_day):
    return date(month_day.year, month_day.month, 1)


def _next_month(month_day):
    return date(month_day.year + (month_day.month == 12), (month_day.month % 12) + 1, 1)


def ensure_recurring(account, today=None):
    today = today or date.today()
    current_month = _first_of(today)
    for series in RecurringExpense.objects.for_account(account).filter(ended=False):
        month = _first_of(series.start_date) if series.last_logged_month is None else _next_month(series.last_logged_month)
        logged_any = False
        while month <= current_month:
            # Same day as the start date, or the last day of shorter months (so the 31st becomes the 30th in April).
            day = min(series.start_date.day, monthrange(month.year, month.month)[1])
            entry_date = date(month.year, month.month, day)
            if entry_date > today:
                break  # this month's day hasn't come yet, so it's added on that day
            Expense.objects.create(
                business_account=account,
                date=entry_date,
                amount=series.amount,
                category=series.category,
                description=series.description,
                vendor=series.vendor,
                note=series.note,
                recurring=series,
            )
            series.last_logged_month = month
            logged_any = True
            month = _next_month(month)
        if logged_any:
            series.save(update_fields=["last_logged_month"])


def stop_recurring(series, today=None):
    """Stops a repeating expense. Past months stay on the books. Future months that were already added are removed."""
    today = today or date.today()
    series.ended = True
    series.ended_on = today
    series.save(update_fields=["ended", "ended_on"])
    Expense.objects.filter(recurring=series, date__gt=today).delete()
