import csv
from datetime import date

from django.http import HttpResponse

from clients.models import Client
from invoicing.models import Invoice

from .core import expenses_between, payments_between
from .schedule_c import CATEGORY_LABELS, CATEGORY_LINES

# ----------------------------------------------------------------------------
# CSV downloads for the accountant (or for your own records). Each file has a
# plain header row, so it opens cleanly in Excel, Google Sheets, or Numbers.
# ----------------------------------------------------------------------------

EXPORT_KINDS = ["payments", "invoices", "expenses", "clients", "schedule-c"]


def _response(filename):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def export_payments(account, start, end):
    response = _response(f"mellax-payments-{start}-to-{end}.csv")
    writer = csv.writer(response)
    writer.writerow(["Date received", "Invoice number", "Client", "Payment method", "Type", "Amount"])
    for p in payments_between(account, start, end).select_related("invoice", "client", "tender_type").order_by("date_received", "id"):
        writer.writerow([
            p.date_received.isoformat(),
            p.invoice.invoice_number,
            p.client.full_name,
            p.tender_type.name,
            "Refund" if p.is_refund else "Payment",
            f"{p.amount:.2f}",
        ])
    return response


def export_invoices(account, start, end):
    response = _response(f"mellax-invoices-{start}-to-{end}.csv")
    writer = csv.writer(response)
    writer.writerow(["Invoice number", "Date issued", "Client", "Status", "Subtotal", "Sales tax", "Total due"])
    invoices = Invoice.objects.for_account(account).filter(issued_date__gte=start, issued_date__lte=end).select_related("client").order_by("issued_date", "id")
    for invoice in invoices:
        writer.writerow([
            invoice.invoice_number,
            invoice.issued_date.isoformat(),
            invoice.client.full_name,
            invoice.get_status_display(),
            f"{invoice.subtotal():.2f}",
            f"{invoice.tax_amount:.2f}",
            f"{invoice.total_due():.2f}",
        ])
    return response


def export_expenses(account, start, end):
    response = _response(f"mellax-expenses-{start}-to-{end}.csv")
    writer = csv.writer(response)
    writer.writerow(["Date", "Category", "Schedule C line", "Description", "Vendor", "Amount", "Note"])
    for e in expenses_between(account, start, end).order_by("date", "id"):
        writer.writerow([
            e.date.isoformat(),
            CATEGORY_LABELS.get(e.category, e.category),
            CATEGORY_LINES.get(e.category, ""),
            e.description,
            e.vendor,
            f"{e.amount:.2f}",
            e.note,
        ])
    return response


def export_clients(account, start, end):
    response = _response(f"mellax-clients-{start}-to-{end}.csv")
    writer = csv.writer(response)
    writer.writerow(["First name", "Last name", "Email", "Phone", "Address", "City", "State", "Zip", "Date added"])
    clients = Client.objects.for_account(account).filter(created_at__date__gte=start, created_at__date__lte=end).order_by("last_name", "first_name")
    for c in clients:
        writer.writerow([c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip_code, c.created_at.date().isoformat()])
    return response


def export_schedule_c(account, year, summary):
    response = _response(f"mellax-schedule-c-{year}.csv")
    writer = csv.writer(response)
    writer.writerow(["Schedule C line", "Description", "Amount"])
    for row in summary["lines"]:
        writer.writerow([row["line"], row["label"], f"{row['amount']:.2f}"])
    writer.writerow([])
    for note in summary["notes"]:
        writer.writerow(["Note", note, ""])
    return response
