from invoicing.models import Invoice, InvoiceLineItem, TenderType
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


class OverpaymentTests(TestCase):
    """A payment can't be more than what's left on the invoice."""

    def setUp(self):
        from clients.models import Client
        from services.models import Service

        self.account = BusinessAccount.objects.create_user(email="pay@example.com", business_name="Pay Co", password="testpass123")
        self.client_record = Client.objects.create(business_account=self.account, first_name="Pat", last_name="Pay")
        self.service = Service.objects.create(business_account=self.account, name="Trim", price=Decimal("100"), is_taxable=False)
        self.invoice = Invoice.objects.create(business_account=self.account, client=self.client_record, invoice_number="INV-PAY", status=Invoice.STATUS_UNPAID)
        InvoiceLineItem.objects.create(invoice=self.invoice, service=self.service, quantity=1, unit_price=Decimal("100"))
        self.cash = TenderType.objects.get(name="Cash", business_account=None)
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def pay(self, amount, is_refund=False):
        return self.api.post("/api/invoicing/payments/", {
            "client": self.client_record.pk, "invoice": self.invoice.pk, "tender_type": self.cash.pk,
            "amount": str(amount), "is_refund": is_refund,
        }, format="json")

    def test_payment_larger_than_the_balance_is_refused(self):
        response = self.pay("100.01")
        self.assertEqual(response.status_code, 400)
        self.assertIn("balance due", str(response.json()))

    def test_payment_for_exactly_the_balance_is_accepted(self):
        self.assertEqual(self.pay("60.00").status_code, 201)
        self.assertEqual(self.pay("40.00").status_code, 201)

    def test_nothing_left_to_pay_is_refused(self):
        self.assertEqual(self.pay("100.00").status_code, 201)
        response = self.pay("1.00")
        self.assertEqual(response.status_code, 400)
        self.assertIn("paid in full", str(response.json()))


class TotalsMatchTests(TestCase):
    """The create-screen preview and the saved invoice must always agree, to the cent."""

    def setUp(self):
        from clients.models import Client
        from services.models import Service

        self.account = BusinessAccount.objects.create_user(
            email="totals@example.com", business_name="Totals Co", password="testpass123",
            service_tax_percent=Decimal("8.50"), product_tax_percent=Decimal("0"),
        )
        self.client_record = Client.objects.create(business_account=self.account, first_name="Tot", last_name="Als")
        self.crm = Service.objects.create(business_account=self.account, name="CRM", price=Decimal("500"), is_taxable=True)
        self.product = Service.objects.create(business_account=self.account, name="Test Product", price=Decimal("100"), is_product=True, is_taxable=True)
        from invoicing.models import Discount
        self.family = Discount.objects.create(business_account=self.account, name="Family/Friends", type=Discount.TYPE_PERCENT, amount=Decimal("15"))
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def saved_total(self, lines, discount_id=None):
        payload = {
            "client": self.client_record.pk,
            "line_items": [{"service": s.pk, "quantity": "1", "discount_type": "flat", "discount_value": None} for s in lines],
            "status": "unpaid",
        }
        if discount_id:
            payload["discount"] = discount_id
        response = self.api.post("/api/invoicing/invoices/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        invoice = Invoice.objects.get(pk=response.json()["id"])
        return invoice.subtotal(), invoice.tax_amount, invoice.discount_amount(), invoice.total_due()

    def test_the_reported_case_matches_to_the_cent(self):
        # CRM ($500, taxed at 8.5%) plus a Test Product ($100, taxed at the product rate of 0%), 15% off.
        subtotal, tax, discount, total = self.saved_total([self.crm, self.product], self.family.pk)
        self.assertEqual((subtotal, tax, discount, total), (Decimal("600.00"), Decimal("42.50"), Decimal("96.38"), Decimal("546.12")))

    def test_totals_helper_matches_the_saved_invoice(self):
        from .totals import compute_totals

        lines = [{"service": self.crm, "quantity": Decimal("1"), "unit_price": self.crm.price, "discount_type": None, "discount_value": None},
                 {"service": self.product, "quantity": Decimal("1"), "unit_price": self.product.price, "discount_type": None, "discount_value": None}]
        helper = compute_totals(self.account, lines, self.family)
        self.assertEqual(helper["total"], Decimal("546.12"))
        self.assertEqual(helper["tax"], Decimal("42.50"))
        self.assertEqual(helper["discount"], Decimal("96.38"))

    def test_preview_endpoint_matches_the_saved_invoice(self):
        payload = {
            "line_items": [
                {"service": self.crm.pk, "quantity": "1", "discount_type": "flat", "discount_value": None},
                {"service": self.product.pk, "quantity": "1", "discount_type": "flat", "discount_value": None},
            ],
            "discount": self.family.pk,
        }
        preview = self.api.post("/api/invoicing/invoices/preview/", payload, format="json")
        self.assertEqual(preview.status_code, 200, preview.content)
        saved = self.saved_total([self.crm, self.product], self.family.pk)
        self.assertEqual(preview.json()["total"], f"{saved[3]:.2f}")
        self.assertEqual(preview.json()["tax"], f"{saved[1]:.2f}")
        self.assertEqual(preview.json()["discount"], f"{saved[2]:.2f}")
        self.assertEqual(preview.json()["total"], "546.12")

    def test_preview_saves_nothing(self):
        before = Invoice.objects.for_account(self.account).count()
        self.api.post("/api/invoicing/invoices/preview/", {"line_items": [{"service": self.crm.pk, "quantity": "1"}]}, format="json")
        self.assertEqual(Invoice.objects.for_account(self.account).count(), before)

    def test_preview_refuses_someone_elses_service(self):
        other = BusinessAccount.objects.create_user(email="other-totals@example.com", business_name="Other", password="testpass123")
        from services.models import Service
        theirs = Service.objects.create(business_account=other, name="Theirs", price=Decimal("5"))
        response = self.api.post("/api/invoicing/invoices/preview/", {"line_items": [{"service": theirs.pk, "quantity": "1"}]}, format="json")
        self.assertEqual(response.status_code, 400)


from cryptography.fernet import Fernet  # noqa: E402
from django.test import override_settings as _override  # noqa: E402
from unittest import mock as _mock  # noqa: E402

CARD_KEYS = {"secret": "sk_test_fake", "publishable": "pk_test_fake", "mode": "test"}
CARD_TEST_KEY = Fernet.generate_key().decode()


@_override(INTEGRATION_ENCRYPTION_KEY=CARD_TEST_KEY)
class CardPaymentTests(TestCase):
    def setUp(self):
        from clients.models import Client
        from integrations.crypto import encrypt_secrets
        from integrations.models import IntegrationConnection
        from services.models import Service

        self.account = BusinessAccount.objects.create_user(email="card@example.com", business_name="Card Co", password="testpass123", plan_tier="plus")
        self.client_record = Client.objects.create(business_account=self.account, first_name="Cal", last_name="Card")
        self.service = Service.objects.create(business_account=self.account, name="Trim", price=Decimal("100"), is_taxable=False)
        self.invoice = Invoice.objects.create(business_account=self.account, client=self.client_record, invoice_number="INV-CARD", status=Invoice.STATUS_UNPAID)
        InvoiceLineItem.objects.create(invoice=self.invoice, service=self.service, quantity=1, unit_price=Decimal("100"))
        IntegrationConnection.objects.create(
            business_account=self.account, integration="stripe",
            secrets=encrypt_secrets({"secret_key": "sk_test_fake", "publishable_key": "pk_test_fake"}), options={"mode": "test"},
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def succeeded(self, amount_cents=10000, brand="visa", last4="4242"):
        return {"id": "pi_1", "status": "succeeded", "amount_received": amount_cents,
                "latest_charge": {"payment_method_details": {"card": {"brand": brand, "last4": last4}}}}

    def start(self, amount="100"):
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.create_intent", return_value={"id": "pi_1", "client_secret": "pi_1_secret"}):
            return self.api.post(f"/api/invoicing/invoices/{self.invoice.pk}/card-payment/", {"amount": amount}, format="json")

    def confirm(self, intent=None):
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.retrieve_intent", return_value=intent or self.succeeded()):
            return self.api.post(f"/api/invoicing/invoices/{self.invoice.pk}/card-payment/confirm/", {"payment_intent_id": "pi_1"}, format="json")

    def test_basic_accounts_cannot_take_card_payments(self):
        self.account.plan_tier = "basic"
        self.account.save()
        self.assertEqual(self.start().status_code, 403)

    def test_the_form_gets_the_publishable_key_never_the_secret(self):
        response = self.api.get("/api/invoicing/stripe/config/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["publishable_key"], "pk_test_fake")
        self.assertNotIn("sk_test", response.content.decode())

    def test_starting_a_payment_returns_the_client_secret(self):
        response = self.start("40")
        self.assertEqual(response.status_code, 201, response.content)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.pending_payment_intent, "pi_1")

    def test_a_charge_above_the_balance_is_refused_before_stripe_is_called(self):
        response = self.start("100.01")
        self.assertEqual(response.status_code, 400)
        self.assertIn("balance due", str(response.json()))

    def test_confirming_records_the_card_and_marks_the_invoice_paid(self):
        self.start()
        response = self.confirm()
        self.assertEqual(response.status_code, 201, response.content)
        payment = PaymentRecord.objects.get(invoice=self.invoice)
        self.assertEqual((payment.processor, payment.card_brand, payment.card_last4), ("stripe", "visa", "4242"))
        self.assertEqual(payment.tender_type.name, "Visa")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.STATUS_PAID)
        self.assertEqual(self.invoice.pending_payment_intent, "")

    def test_confirming_twice_records_one_payment(self):
        self.start()
        self.confirm()
        self.confirm()
        self.assertEqual(PaymentRecord.objects.filter(invoice=self.invoice).count(), 1)

    def test_a_charge_that_did_not_go_through_is_not_recorded(self):
        self.start()
        response = self.confirm({"id": "pi_1", "status": "requires_payment_method"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(PaymentRecord.objects.filter(invoice=self.invoice).exists())

    def test_a_full_refund_goes_back_through_stripe(self):
        self.start()
        self.confirm()
        payment = PaymentRecord.objects.get(invoice=self.invoice)
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.refund_intent", return_value={"id": "re_1"}) as refund:
            response = self.api.post(f"/api/invoicing/payments/{payment.pk}/stripe-refund/", {}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(refund.call_args.args[2], Decimal("100"))
        refund_record = PaymentRecord.objects.get(invoice=self.invoice, is_refund=True)
        self.assertEqual(refund_record.processor_reference, "re_1")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.STATUS_REFUNDED)

    def test_a_refund_cannot_exceed_what_is_left_to_refund(self):
        self.start()
        self.confirm()
        payment = PaymentRecord.objects.get(invoice=self.invoice)
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.refund_intent", return_value={"id": "re_2"}):
            response = self.api.post(f"/api/invoicing/payments/{payment.pk}/stripe-refund/", {"amount": "100.50"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_an_invoice_with_a_card_payment_cannot_be_deleted(self):
        self.start()
        self.confirm()
        with _mock.patch("invoicing.stripe_payments.stripe_keys", return_value=CARD_KEYS):
            response = self.api.delete(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertIn("Refund it through Stripe first", str(response.json()))
        self.assertTrue(Invoice.objects.filter(pk=self.invoice.pk).exists())

    def test_deleting_an_invoice_cancels_a_charge_that_never_went_through(self):
        self.start()
        with _mock.patch("invoicing.stripe_payments.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.stripe_payments.cancel_intent") as cancel:
            response = self.api.delete(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertEqual(response.status_code, 204, response.content)
        cancel.assert_called_once()
        self.assertFalse(Invoice.objects.filter(pk=self.invoice.pk).exists())

    def test_a_stripe_payment_cannot_be_deleted_from_the_payments_list(self):
        self.start()
        self.confirm()
        payment = PaymentRecord.objects.get(invoice=self.invoice)
        response = self.api.delete(f"/api/invoicing/payments/{payment.pk}/")
        self.assertEqual(response.status_code, 403)

    # If the browser never calls .../confirm/ (closed tab, dropped wifi) right as Stripe
    # approves a card, opening the invoice should catch it anyway instead of staying stuck
    # "unpaid" forever while Stripe already has the money.
    def test_opening_the_invoice_records_a_payment_we_never_heard_back_about(self):
        self.start()
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.retrieve_intent", return_value=self.succeeded()):
            response = self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertEqual(response.status_code, 200, response.content)
        payment = PaymentRecord.objects.get(invoice=self.invoice)
        self.assertEqual((payment.processor, payment.card_brand, payment.card_last4), ("stripe", "visa", "4242"))
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.STATUS_PAID)
        self.assertEqual(self.invoice.pending_payment_intent, "")

    def test_opening_the_invoice_twice_does_not_double_record_it(self):
        self.start()
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.retrieve_intent", return_value=self.succeeded()):
            self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
            self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertEqual(PaymentRecord.objects.filter(invoice=self.invoice).count(), 1)

    def test_opening_the_invoice_while_still_processing_leaves_it_alone(self):
        self.start()
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.retrieve_intent", return_value={"id": "pi_1", "status": "processing"}):
            self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertFalse(PaymentRecord.objects.filter(invoice=self.invoice).exists())
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.pending_payment_intent, "pi_1")

    def test_opening_the_invoice_clears_a_charge_that_was_canceled(self):
        self.start()
        with _mock.patch("invoicing.card_views.stripe_keys", return_value=CARD_KEYS), \
             _mock.patch("invoicing.card_views.retrieve_intent", return_value={"id": "pi_1", "status": "canceled"}):
            self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.pending_payment_intent, "")

    def test_opening_the_invoice_with_no_pending_charge_does_not_call_stripe(self):
        with _mock.patch("invoicing.card_views.stripe_keys") as keys:
            response = self.api.get(f"/api/invoicing/invoices/{self.invoice.pk}/")
        self.assertEqual(response.status_code, 200)
        keys.assert_not_called()
