from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from invoicing.models import Invoice, InvoiceLineItem, PaymentRecord

from .models import Expense
from .recurring import ensure_recurring

# ----------------------------------------------------------------------------
# The rules every report shares. Keeping them in one place means the growth
# dashboard, the profit report, the tax center, and the exports always agree.
#
# Two dates matter:
#   - Money (payments and refunds) is counted on the day it was RECEIVED.
#   - Sales and sales tax are counted on the day the invoice was ISSUED.
# Each report says which one it uses, so nothing is a surprise at tax time.
# ----------------------------------------------------------------------------

CENTS = Decimal("0.01")

# Invoices that represent real, collected or partly collected sales. Refunded
# invoices still count, so a refund doesn't quietly drop a sale from the
# cost and tax numbers.
QUALIFYING_STATUSES = [Invoice.STATUS_PAID, Invoice.STATUS_REFUNDED]


def money(value):
    return Decimal(value or 0).quantize(CENTS)


def parse_dates(request, default_start, default_end):
    """Reads ?start= and ?end= from the request, with a clear error when they're wrong."""
    raw_start = request.query_params.get("start")
    raw_end = request.query_params.get("end")
    try:
        start = date.fromisoformat(raw_start) if raw_start else default_start
        end = date.fromisoformat(raw_end) if raw_end else default_end
    except ValueError as exc:
        raise ValidationError({"detail": "Dates need to look like 2026-03-31."}) from exc
    if start > end:
        raise ValidationError({"detail": "The start date needs to be on or before the end date."})
    return start, end


def shift_one_year(day):
    # Same day last year. February 29 becomes February 28 when last year wasn't a leap year.
    try:
        return day.replace(year=day.year - 1)
    except ValueError:
        return day.replace(year=day.year - 1, day=28)


def account_timezone(account):
    try:
        return ZoneInfo(account.time_zone)
    except (DjangoValidationError, KeyError, ValueError):
        return ZoneInfo("UTC")


def payments_between(account, start, end):
    return PaymentRecord.objects.for_account(account).filter(date_received__gte=start, date_received__lte=end)


def revenue_between(account, start, end):
    """Returns (gross money in, refunds out, net money) for payments received in the range."""
    payments = payments_between(account, start, end)
    gross = money(payments.filter(is_refund=False).aggregate(total=Sum("amount"))["total"])
    refunds = money(payments.filter(is_refund=True).aggregate(total=Sum("amount"))["total"])
    return gross, refunds, gross - refunds


def _tax_share(invoice):
    # The fraction of an invoice's pre-discount total that is sales tax.
    # Discounts shrink the tax and the sale by the same fraction, so this share holds for partial payments too.
    base = invoice.subtotal() + invoice.tax_amount
    if not invoice.tax_amount or base <= 0:
        return Decimal("0")
    return invoice.tax_amount / base


def revenue_ex_tax_between(account, start, end):
    """
    Like revenue_between(), but without the sales tax. Sales tax you collect
    belongs to the state, not to the business, so it isn't income.
    Returns (gross sales in, refunds out, net sales), each before sales tax.
    """
    gross = Decimal("0")
    refunds = Decimal("0")
    for payment in payments_between(account, start, end).select_related("invoice"):
        ex_tax = payment.amount * (Decimal("1") - _tax_share(payment.invoice))
        if payment.is_refund:
            refunds += ex_tax
        else:
            gross += ex_tax
    gross, refunds = money(gross), money(refunds)
    return gross, refunds, gross - refunds


def sales_invoices_between(account, start, end):
    """Paid or refunded invoices issued in the range. These are the sales for sales and cost reports."""
    return Invoice.objects.for_account(account).filter(
        status__in=QUALIFYING_STATUSES, issued_date__gte=start, issued_date__lte=end
    )


def sale_lines(invoices):
    """Lines that were actually sold. Voided lines and refund lines are left out."""
    return InvoiceLineItem.objects.filter(invoice__in=invoices, is_voided=False, is_refund_line=False)


def cost_of_goods(invoices):
    total = Decimal("0")
    for line in sale_lines(invoices).exclude(unit_cost__isnull=True).select_related("service"):
        total += line.cost_amount()
    return money(total)


def expenses_between(account, start, end):
    # Repeating expenses are brought up to date first, so this month's rent shows up without anyone pressing anything.
    ensure_recurring(account)
    return Expense.objects.for_account(account).filter(date__gte=start, date__lte=end)
