from datetime import date
from decimal import Decimal

from django.db.models import Sum

from invoicing.models import Invoice

from .core import cost_of_goods, expenses_between, money, revenue_ex_tax_between, sale_lines, sales_invoices_between
from .models import OtherIncome
from .schedule_c import CATEGORY_LABELS, CATEGORY_LINES, SCHEDULE_C_CATEGORIES
from .growth import month_bounds
from .schedule_c import SCHEDULE_C_CATEGORIES

# ----------------------------------------------------------------------------
# The tax center's numbers. The year summary follows the order of Schedule C, so
# an accountant can check each line against the form. The quarterly table gives
# the sales and tax figures for any state's sales tax or gross receipts return.
#
# MellaX doesn't decide what's taxable in your state. It reports the sales
# split by each service's own "taxable" setting, and your accountant or your
# state's revenue department decides the rules.
# ----------------------------------------------------------------------------


def year_summary(account, year):
    start, end = date(year, 1, 1), date(year, 12, 31)
    gross, refunds, net_receipts = revenue_ex_tax_between(account, start, end)
    invoices = sales_invoices_between(account, start, end)
    cogs = cost_of_goods(invoices)
    gross_profit = money(net_receipts - cogs)

    # Expenses grouped by Schedule C category. Every category is shown, even at zero, so nothing looks missing.
    expense_totals = {key: Decimal("0") for key, *_ in SCHEDULE_C_CATEGORIES}
    for expense in expenses_between(account, start, end):
        expense_totals[expense.category] += expense.amount
    expense_lines = [
        {"line": line, "label": label, "amount": money(expense_totals[key]), "category": key}
        for key, label, line, _hint in SCHEDULE_C_CATEGORIES
    ]
    total_expenses = money(sum((row["amount"] for row in expense_lines), Decimal("0")))
    # Other income (tips, reimbursements) is added on line 6, so it counts toward gross income and profit.
    other_income = money(sum((i.amount for i in OtherIncome.objects.for_account(account).filter(date__gte=start, date__lte=end)), Decimal("0")))
    gross_income = money(gross_profit + other_income)
    tentative_profit = money(gross_income - total_expenses)

    tax_collected = money(invoices.aggregate(total=Sum("tax_amount"))["total"])

    lines = [
        {"line": "1", "label": "Gross receipts, before sales tax", "amount": gross},
        {"line": "2", "label": "Returns and refunds", "amount": refunds},
        {"line": "3", "label": "Net receipts", "amount": net_receipts},
        {"line": "4", "label": "Cost of goods sold", "amount": cogs},
        {"line": "5", "label": "Gross profit", "amount": gross_profit},
        {"line": "6", "label": "Other income (tips, reimbursements)", "amount": other_income},
        {"line": "7", "label": "Gross income", "amount": gross_income},
        *expense_lines,
        {"line": "28", "label": "Total expenses", "amount": total_expenses},
        {"line": "29", "label": "Tentative profit", "amount": tentative_profit},
        {"line": "31", "label": "Net profit (before home office, line 30)", "amount": tentative_profit},
    ]
    return {
        "year": year,
        "start": start,
        "end": end,
        "lines": lines,
        "totals": {
            "gross_receipts": gross,
            "refunds": refunds,
            "net_receipts": net_receipts,
            "cost_of_goods_sold": cogs,
            "other_income": other_income,
            "total_expenses": total_expenses,
            "net_profit": tentative_profit,
        },
        "sales_tax_collected": tax_collected,
        "notes": [
            "Gross receipts count payments by the day they were received, before the sales tax part of each payment.",
            "Cost of goods sold counts sales by the day the invoice was issued.",
            "Sales tax collected is not part of Schedule C. Report it on your state's sales tax return.",
            "Home office (line 30) and any other income aren't included. Add them with your accountant.",
        ],
    }


def quarter_summary(account, year, service_rate, product_rate):
    """Sales, taxable sales, and tax collected for each quarter. Sales are counted by the day the invoice was issued."""
    quarters = []
    for q in range(4):
        first_month = q * 3 + 1
        start, _ = month_bounds(year, first_month)
        _, end = month_bounds(year, first_month + 2)
        invoices = sales_invoices_between(account, start, end)
        lines = sale_lines(invoices).select_related("service")

        gross_sales = Decimal("0")
        taxable_sales = Decimal("0")
        for line in lines:
            amount = line.net_amount()
            gross_sales += amount
            if line.service.is_taxable:
                taxable_sales += amount

        _, _, net_received_ex_tax = revenue_ex_tax_between(account, start, end)
        quarters.append(
            {
                "quarter": f"Q{q + 1}",
                "start": start,
                "end": end,
                "invoices": invoices.count(),
                "sales": money(gross_sales),
                "taxable_sales": money(taxable_sales),
                "non_taxable_sales": money(gross_sales - taxable_sales),
                "tax_collected": money(invoices.aggregate(total=Sum("tax_amount"))["total"]),
                "payments_received_ex_tax": net_received_ex_tax,
            }
        )

    totals = {
        key: money(sum((row[key] for row in quarters), Decimal("0")))
        for key in ["invoices", "sales", "taxable_sales", "non_taxable_sales", "tax_collected", "payments_received_ex_tax"]
    }
    return {
        "year": year,
        "service_tax_rate": service_rate,
        "product_tax_rate": product_rate,
        "quarters": quarters,
        "totals": totals,
        "notes": [
            "Sales are paid or refunded invoices, counted by the day each invoice was issued.",
            "Taxable sales use each service's own taxable setting. Check that setting for each service.",
            "Discounts on whole invoices aren't split between taxable and non-taxable sales, so these figures come before those discounts.",
            "Payments received are shown before sales tax. Some states tax gross receipts instead of sales, so check which one applies to you.",
        ],
    }


def readiness(account, year):
    """
    The checks an owner should clear before filing. Each one says what's wrong and what to do,
    so nothing is a surprise when the accountant asks.
    """
    start, end = date(year, 1, 1), date(year, 12, 31)
    checks = []

    unpaid = [i for i in Invoice.objects.for_account(account).filter(status=Invoice.STATUS_UNPAID, issued_date__gte=start, issued_date__lte=end)]
    if unpaid:
        owed = money(sum((i.total_due() for i in unpaid), Decimal("0")))
        checks.append({"key": "unpaid", "status": "warn", "title": f"{len(unpaid)} unpaid invoice(s) from {year}",
                       "detail": f"{owed} is still owed. Record the payments, or void the invoices that won't be paid."})
    else:
        checks.append({"key": "unpaid", "status": "ok", "title": "Every invoice is paid or voided", "detail": ""})

    missing_cost = sale_lines(sales_invoices_between(account, start, end)).filter(service__is_product=True, unit_cost__isnull=True).count()
    if missing_cost:
        checks.append({"key": "product_cost", "status": "warn", "title": f"{missing_cost} product sale(s) have no cost",
                       "detail": "Add what each product costs you on the Products page, so cost of goods is right."})
    else:
        checks.append({"key": "product_cost", "status": "ok", "title": "Product costs are set", "detail": ""})

    expense_count = expenses_between(account, start, end).count()
    checks.append({"key": "expenses", "status": "ok" if expense_count else "warn",
                   "title": f"{expense_count} expense(s) logged for {year}",
                   "detail": "" if expense_count else "No expenses logged yet. Log rent, supplies, ads, and other costs on the Expenses tab."})

    if not account.state:
        checks.append({"key": "state", "status": "warn", "title": "Your state isn't set",
                       "detail": "Add your business address in Settings, so the sales tax section knows which state to show."})
    else:
        checks.append({"key": "state", "status": "ok", "title": f"Business state: {account.state}", "detail": ""})

    refunds = Invoice.objects.for_account(account).filter(status=Invoice.STATUS_REFUNDED, issued_date__gte=start, issued_date__lte=end).count()
    if refunds:
        checks.append({"key": "refunds", "status": "info", "title": f"{refunds} refunded invoice(s)",
                       "detail": "Refunds are already taken off the totals. Your accountant may want to see them listed."})
    return checks


def tax_packet(account, year):
    """Everything for one tax year, in one place: the printable packet and the numbers behind it."""
    start, end = date(year, 1, 1), date(year, 12, 31)
    summary = year_summary(account, year)
    expenses = [
        {
            "date": e.date,
            "category": CATEGORY_LABELS.get(e.category, e.category),
            "line": CATEGORY_LINES.get(e.category, ""),
            "description": e.description,
            "vendor": e.vendor,
            "amount": e.amount,
            "note": e.note,
        }
        for e in expenses_between(account, start, end).order_by("date", "id")
    ]

    other = [
        {"date": i.date, "description": i.description, "amount": i.amount, "note": i.note}
        for i in OtherIncome.objects.for_account(account).filter(date__gte=start, date__lte=end).order_by("date", "id")
    ]
    invoices = [
        {
            "number": i.invoice_number, "issued": i.issued_date, "client": i.client.full_name,
            "status": i.get_status_display(), "total": money(i.total_due()),
        }
        for i in Invoice.objects.for_account(account).filter(issued_date__gte=start, issued_date__lte=end)
        .exclude(status__in=[Invoice.STATUS_QUOTE, Invoice.STATUS_VOID]).select_related("client").order_by("issued_date", "id")
    ]
    return {
        "year": year,
        "prepared_on": date.today(),
        "business": {"name": account.business_name, "address_lines": account.formatted_address_lines(), "state": account.state},
        "summary": summary,
        "expenses": expenses,
        "other_income": other,
        "invoices": invoices,
        "readiness": readiness(account, year),
    }
