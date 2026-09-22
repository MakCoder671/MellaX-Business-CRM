from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import BusinessAccount
from clients.models import Client
from invoicing.models import Invoice, PaymentRecord
from services.models import Service


class InvoicePaymentFlowTests(TestCase):
    def setUp(self):
        self.account = BusinessAccount.objects.create_user(
            email="billing@example.com",
            business_name="Billing Co.",
            password="securepass123",
            is_email_verified=True,
            service_tax_percent=Decimal("8.25"),
        )
        self.client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.account)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        self.customer = Client.objects.create(
            business_account=self.account,
            first_name="Dana",
            last_name="Client",
            email="dana@client.example",
            phone="555-2000",
        )
        self.service = Service.objects.create(
            business_account=self.account,
            name="Consulting",
            price=Decimal("150.00"),
            description="Monthly consulting",
            is_taxable=True,
        )

    def test_invoice_creation_and_payment_marks_invoice_paid(self):
        invoice_response = self.client.post(
            reverse("invoice-list"),
            {
                "client": self.customer.pk,
                "status": Invoice.STATUS_UNPAID,
                "notes": "Initial invoice",
                "line_items": [
                    {
                        "service": self.service.pk,
                        "quantity": 1,
                        "discount_type": "flat",
                        "discount_value": None,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(invoice_response.status_code, 201, invoice_response.data)
        invoice = Invoice.objects.get(pk=invoice_response.data["id"])
        self.assertEqual(invoice.status, Invoice.STATUS_UNPAID)
        self.assertEqual(invoice.total_due(), Decimal("162.38"))

        tender_response = self.client.get(reverse("tender-type-list"))
        self.assertEqual(tender_response.status_code, 200)
        cash = next(item for item in tender_response.data if item["name"] == "Cash")

        payment_response = self.client.post(
            reverse("payment-list"),
            {
                "client": self.customer.pk,
                "invoice": invoice.pk,
                "tender_type": cash["id"],
                "amount": "162.38",
                "is_refund": False,
            },
            format="json",
        )

        self.assertEqual(payment_response.status_code, 201, payment_response.data)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.STATUS_PAID)
        self.assertEqual(PaymentRecord.objects.filter(invoice=invoice).count(), 1)
