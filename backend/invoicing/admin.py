from django.contrib import admin

from .models import Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType


class InvoiceLineItemInline(admin.TabularInline):
    # An "inline" lets you edit an invoice's line items right on the same
    # admin page as the invoice itself, in a little table, instead of
    # needing to jump to a separate "line items" list page.
    model = InvoiceLineItem
    extra = 0  # don't show 3 blank empty rows by default like Django normally would


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "business_account", "client", "status", "issued_date")
    inlines = [InvoiceLineItemInline]


admin.site.register(TenderType)
admin.site.register(Discount)
admin.site.register(PaymentRecord)
