from django.contrib import admin

from .models import Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType


class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "business_account", "client", "status", "issued_date")
    inlines = [InvoiceLineItemInline]


admin.site.register(TenderType)
admin.site.register(Discount)
admin.site.register(PaymentRecord)
