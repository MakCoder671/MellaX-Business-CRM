from decimal import Decimal, InvalidOperation

from django.core.mail import EmailMultiAlternatives
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from common.views import TenantScopedModelViewSet
from services.models import Service

from .models import VOID_AGE, Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType
from .serializers import (
    DiscountSerializer,
    InvoiceSerializer,
    PaymentRecordSerializer,
    TenderTypeSerializer,
)


def _recompute_tax(invoice):
    # Shared by add_line_item() and void_line_item() below — a line item
    # changing (added, revised, or voided) always changes what's
    # taxable, so the stored tax_amount has to be redone from scratch
    # against whatever's currently NOT voided. Rounded to the cent — see
    # the note on Invoice.total_due() for why that matters for the
    # "paid in full" check to ever actually trigger.
    total = Decimal("0")
    for item in invoice.line_items.filter(is_voided=False):
        if item.service.is_taxable:
            total += item.net_amount() * (invoice.business_account.service_tax_percent / Decimal("100"))
    invoice.tax_amount = total.quantize(Decimal("0.01"))
    invoice.save(update_fields=["tax_amount"])


def _build_invoice_html_email(request, account, invoice, client):
    """
    A plain, letterhead-style HTML version of the invoice to send by
    email — same information as the print page, condensed into an inline-
    styled table (email clients don't reliably support external
    stylesheets or Tailwind classes), following the same pattern as
    marketing/views.py's e-blast email builder.
    """
    logo_html = ""
    if account.logo:
        logo_url = request.build_absolute_uri(account.logo.url)
        logo_html = (
            f'<img src="{escape(logo_url)}" alt="{escape(account.business_name)}" '
            f'style="height:48px;width:auto;margin-bottom:16px;">'
        )

    rows_html = "".join(
        f"""
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">{escape(item.service.name)}</td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">{item.quantity}</td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${item.unit_price:.2f}</td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${item.net_amount():.2f}</td>
        </tr>
        """
        for item in invoice.line_items.filter(is_voided=False)
    )

    paid = invoice.payment_records.filter(is_refund=False).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
    refunded = invoice.payment_records.filter(is_refund=True).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
    balance_due = invoice.total_due() - (paid - refunded)
    discount_row = (
        f'<p style="margin:2px 0;">Discount: -${invoice.discount_amount():.2f}</p>' if invoice.discount_id else ""
    )
    address_line = f"<br>{escape(account.address)}" if account.address else ""

    return f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      {logo_html}
      <p style="font-size:18px;font-weight:600;margin:0 0 4px;">{escape(account.business_name)}</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Invoice {escape(invoice.invoice_number)} · {invoice.issued_date}</p>

      <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Bill to</p>
      <p style="margin:0 0 24px;">{escape(client.full_name)}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;font-size:12px;color:#9ca3af;text-transform:uppercase;">
            <th style="padding-bottom:6px;">Service</th>
            <th style="padding-bottom:6px;text-align:right;">Qty</th>
            <th style="padding-bottom:6px;text-align:right;">Price</th>
            <th style="padding-bottom:6px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>{rows_html}</tbody>
      </table>

      <div style="margin-top:16px;text-align:right;font-size:14px;">
        <p style="margin:2px 0;">Tax: ${invoice.tax_amount:.2f}</p>
        {discount_row}
        <p style="margin:2px 0;font-weight:600;">Total: ${invoice.total_due():.2f}</p>
        <p style="margin:2px 0;">Balance due: ${balance_due:.2f}</p>
      </div>

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        {escape(account.business_name)}{address_line}
      </p>
    </div>
    """


class InvoiceViewSet(TenantScopedModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        # Powers the client profile's "Purchases" tab from the plan doc —
        # the frontend calls GET /api/invoicing/invoices/?client=5 to get
        # just that one client's invoice history — and, with status/
        # start/end instead, the Reports page's Invoices tab (no
        # standalone Invoices list anymore; per Mako, that view belongs
        # in Reports, filterable by paid vs. has-a-balance and by date range).
        queryset = super().get_queryset()  # this already filters to just the logged-in account's own invoices

        # Auto-void: per Mako, every invoice locks AND its status flips
        # to Void automatically once it's 24 hours old — not something
        # that waits for someone to click a button, and not something
        # that only affects unpaid ones. A single bulk UPDATE (not a
        # Python loop + one save() per row) catches every invoice on
        # this account that's aged past the cutoff, every time its list
        # or detail view gets loaded — so the status is always accurate
        # to look at even without a real cron job wired up yet (see the
        # "void_expired_invoices" management command for that).
        Invoice.objects.for_account(self.request.user).exclude(
            status__in=[Invoice.STATUS_VOID, Invoice.STATUS_QUOTE]
        ).filter(created_at__lte=timezone.now() - VOID_AGE).update(status=Invoice.STATUS_VOID)

        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)
        start = self.request.query_params.get("start")
        if start:
            queryset = queryset.filter(issued_date__gte=start)
        end = self.request.query_params.get("end")
        if end:
            queryset = queryset.filter(issued_date__lte=end)
        return queryset.order_by("-issued_date")

    def perform_create(self, serializer):
        # Normally TenantScopedModelViewSet.perform_create() stamps
        # `business_account=request.user` onto every new row automatically
        # (see common/views.py). We skip that here on purpose: our custom
        # InvoiceSerializer.create() already sets business_account itself
        # (it needs the account earlier anyway, to compute tax and the
        # next invoice number before the row even exists) — doing it again
        # here would just be a duplicate, conflicting argument.
        serializer.save()

    def perform_destroy(self, instance):
        # Per Mako: any invoice can be deleted outright for its first 24
        # hours — after that it's a real record, automatically locked
        # and voided (see Invoice.is_locked()/sync_void_status()), so
        # the row itself always sticks around from that point on.
        if instance.is_locked():
            raise PermissionDenied("This invoice has been voided and can't be deleted.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="line-items")
    def add_line_item(self, request, pk=None):
        """
        POST /api/invoicing/invoices/<id>/line-items/ — the only way to
        add, revise, or remove (see void_line_item below) a line item
        once an invoice already exists. Per Mako: nothing about a line
        item ever actually gets deleted. Pass `replaces` (an existing
        line item's id) plus a `note` explaining why, and that old row
        gets marked voided — shown crossed out on the invoice, with the
        note underneath — while this new one takes its place. Leave
        `replaces` off to just add a fresh line, which is also how a
        Refund gets recorded: a line with is_refund_line true and a
        custom unit_price, since a refund amount won't usually match the
        service's current listed price (a partial refund, a price
        that's since changed).
        """
        invoice = self.get_object()
        if invoice.is_locked():
            return Response({"detail": "This invoice has been voided and can't be changed."}, status=400)

        data = request.data
        service = Service.objects.for_account(request.user).filter(pk=data.get("service")).first()
        if service is None:
            return Response({"detail": "Service not found."}, status=400)

        try:
            quantity = Decimal(str(data.get("quantity") or "1"))
        except InvalidOperation:
            return Response({"detail": "Invalid quantity."}, status=400)

        is_refund_line = bool(data.get("is_refund_line"))
        discount_type = data.get("discount_type") or InvoiceLineItem.DISCOUNT_TYPE_FLAT
        discount_value = data.get("discount_value")
        if discount_value not in (None, ""):
            try:
                discount_value = Decimal(str(discount_value))
            except InvalidOperation:
                return Response({"detail": "Invalid discount value."}, status=400)
            if discount_type == InvoiceLineItem.DISCOUNT_TYPE_PERCENT and discount_value > 100:
                return Response({"detail": "A percent discount can't be more than 100%."}, status=400)
        else:
            discount_value = None

        if is_refund_line:
            try:
                unit_price = Decimal(str(data.get("unit_price")))
            except (InvalidOperation, TypeError):
                return Response({"detail": "A refund needs an amount."}, status=400)
        else:
            unit_price = service.price

        old_item = None
        note = (data.get("note") or "").strip()
        replaces_id = data.get("replaces")
        if replaces_id:
            old_item = invoice.line_items.filter(pk=replaces_id, is_voided=False).first()
            if old_item is None:
                return Response({"detail": "That line item wasn't found."}, status=400)
            if not note:
                return Response({"detail": "A note explaining the change is required."}, status=400)

        with transaction.atomic():
            if old_item is not None:
                old_item.is_voided = True
                old_item.void_note = note
                old_item.save(update_fields=["is_voided", "void_note"])

            InvoiceLineItem.objects.create(
                invoice=invoice,
                service=service,
                quantity=quantity,
                unit_price=unit_price,
                discount_type=discount_type,
                discount_value=discount_value,
                is_refund_line=is_refund_line,
            )
            _recompute_tax(invoice)

        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="void-line-item")
    def void_line_item(self, request, pk=None):
        """
        POST /api/invoicing/invoices/<id>/void-line-item/ — removes a
        line item without deleting it: marked voided (crossed out on the
        invoice) with a required note explaining why, same as a revision
        via add_line_item() above, just without a replacement line.
        """
        invoice = self.get_object()
        if invoice.is_locked():
            return Response({"detail": "This invoice has been voided and can't be changed."}, status=400)

        line_item = invoice.line_items.filter(pk=request.data.get("line_item_id"), is_voided=False).first()
        if line_item is None:
            return Response({"detail": "That line item wasn't found."}, status=400)

        note = (request.data.get("note") or "").strip()
        if not note:
            return Response({"detail": "A note explaining why is required."}, status=400)

        if not invoice.line_items.filter(is_voided=False).exclude(pk=line_item.pk).exists():
            return Response(
                {"detail": "An invoice needs at least one line item. Void the whole invoice instead."}, status=400
            )

        line_item.is_voided = True
        line_item.void_note = note
        line_item.save(update_fields=["is_voided", "void_note"])
        _recompute_tax(invoice)

        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def email(self, request, pk=None):
        """
        POST /api/invoicing/invoices/<id>/email/ — sends this invoice to
        the client on file, same branded-HTML-email pattern as
        marketing/views.py's e-blasts (see _build_invoice_html_email above).
        """
        invoice = self.get_object()
        client = invoice.client
        if not client.email:
            return Response({"detail": "This client doesn't have an email on file."}, status=400)

        html_body = _build_invoice_html_email(request, request.user, invoice, client)
        plain_body = f"Your invoice {invoice.invoice_number} for ${invoice.total_due():.2f} from {request.user.business_name}."

        message = EmailMultiAlternatives(
            subject=f"Invoice {invoice.invoice_number} from {request.user.business_name}",
            body=plain_body,
            from_email=None,  # None = use Django's DEFAULT_FROM_EMAIL setting
            to=[client.email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send()

        return Response({"detail": "Invoice emailed."})


class PaymentRecordViewSet(TenantScopedModelViewSet):
    queryset = PaymentRecord.objects.all()
    serializer_class = PaymentRecordSerializer

    def perform_destroy(self, instance):
        # Same "nothing changes once void" rule as the invoice itself —
        # a payment is part of the locked record at that point too.
        if instance.invoice.is_locked():
            raise PermissionDenied("This invoice has been voided and its payments can't be changed.")
        instance.delete()


class TenderTypeViewSet(TenantScopedModelViewSet):
    """
    Slightly different from a normal tenant-scoped resource: the LIST view
    should show both the system-wide defaults (Cash, Visa, ...) AND this
    account's own custom ones — but creating a new one should only ever
    create a custom one scoped to this account (you can't add a new
    "system default" through the API).
    """

    queryset = TenderType.objects.all()
    serializer_class = TenderTypeSerializer

    def get_queryset(self):
        # Q objects let you build an "OR" condition — this reads as
        # "rows where business_account is empty (a system default) OR
        # rows that belong to me."
        return TenderType.objects.filter(
            Q(business_account__isnull=True) | Q(business_account=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user, is_custom=True)

    def perform_destroy(self, instance):
        # get_queryset() above deliberately includes the system-wide
        # defaults (business_account=None) so they show up in the list —
        # but that means without this check, DELETE would happily let
        # someone delete "Cash" for THEMSELVES and accidentally wipe it
        # out for every account, since it's the same shared row. Only
        # ever allow deleting a tender type that actually belongs to you.
        if instance.business_account_id is None:
            raise PermissionDenied("Default tender types can't be deleted.")
        instance.delete()


class DiscountViewSet(TenantScopedModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
