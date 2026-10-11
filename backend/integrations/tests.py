from datetime import timedelta
from decimal import Decimal
from unittest import mock

from cryptography.fernet import Fernet
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import BusinessAccount
from clients.models import Client
from scheduling.models import Appointment, Calendar

from . import apple_calendar, sync
from .catalog import ACCESS_INCLUDED, ACCESS_ONE_TIME, ACCESS_UPGRADE, CATALOG, access_for, find
from .crypto import decrypt_secrets, encrypt_secrets
from .models import AppointmentSyncLink, IntegrationConnection, IntegrationEntitlement

# Tests run like production, so they need a real key. This one is only for the test run.
TEST_KEY = Fernet.generate_key().decode()

FAKE_CALENDARS = [{"name": "Work", "url": "https://caldav.example.test/cal/work/"}]


def make_account(plan="plus", email="owner@example.com", subscription_status=None):
    account = BusinessAccount.objects.create_user(
        email=email, business_name="Test Salon", password="testpass123", plan_tier=plan
    )
    # Every new account starts as a demo (see accounts/models.py) - most of these tests
    # aren't about that, so they default to "active" rather than incidentally tripping
    # the demo payment-processor block in IntegrationConnectView. Pass "trialing"
    # explicitly for the tests that are actually about demo mode.
    account.subscription_status = subscription_status or BusinessAccount.STATUS_ACTIVE
    account.save(update_fields=["subscription_status"])
    return account


class AccessRulesTests(TestCase):
    def test_calendars_are_free_on_every_plan(self):
        apple = find("apple_calendar")
        for plan in ("basic", "plus", "premium"):
            self.assertEqual(access_for(apple, plan, set()), ACCESS_INCLUDED)

    def test_square_is_a_plus_feature(self):
        square = find("square")
        self.assertEqual(access_for(square, "basic", set()), ACCESS_UPGRADE)
        self.assertEqual(access_for(square, "plus", set()), ACCESS_INCLUDED)

    def test_card_processors_are_plus_features(self):
        # Stripe and Clover work like Square: free on Plus, an upgrade on Basic.
        for key in ("stripe", "clover"):
            entry = find(key)
            self.assertEqual(access_for(entry, "basic", set()), ACCESS_UPGRADE)
            self.assertEqual(access_for(entry, "plus", set()), ACCESS_INCLUDED)

    def test_advanced_integrations_are_one_time_until_bought(self):
        zapier = find("zapier")
        self.assertEqual(access_for(zapier, "basic", set()), ACCESS_ONE_TIME)
        self.assertEqual(access_for(zapier, "plus", set()), ACCESS_ONE_TIME)
        self.assertEqual(access_for(zapier, "plus", {"zapier"}), "owned")
        self.assertEqual(access_for(zapier, "premium", set()), ACCESS_INCLUDED)


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class SecretsTests(TestCase):
    def test_saved_passwords_are_not_stored_in_plain_text(self):
        account = make_account()
        token = encrypt_secrets({"apple_id": "jane@icloud.com", "app_password": "abcd-efgh-ijkl-mnop"})
        self.assertNotIn("abcd-efgh", token)
        self.assertEqual(decrypt_secrets(token)["app_password"], "abcd-efgh-ijkl-mnop")
        self.assertIsNotNone(account.pk)


class CatalogApiTests(TestCase):
    def setUp(self):
        self.account = make_account("basic")
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def test_every_plan_sees_the_whole_store(self):
        response = self.api.get("/api/integrations/")
        self.assertEqual(response.status_code, 200)
        keys = [item["key"] for item in response.json()]
        self.assertIn("apple_calendar", keys)
        self.assertIn("square", keys)
        self.assertIn("zapier", keys)

    def test_basic_sees_square_as_an_upgrade(self):
        square = next(i for i in self.api.get("/api/integrations/").json() if i["key"] == "square")
        self.assertEqual(square["access"], ACCESS_UPGRADE)

    def test_basic_cannot_connect_square(self):
        response = self.api.post("/api/integrations/square/connect/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["access"], ACCESS_UPGRADE)

    def test_google_shows_as_coming_soon_until_its_setup_is_done(self):
        google = next(i for i in self.api.get("/api/integrations/").json() if i["key"] == "google_calendar")
        self.assertEqual(google["status"], "coming_soon")


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class AppleConnectTests(TestCase):
    def setUp(self):
        self.account = make_account("basic")
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)
        self.payload = {"apple_id": "jane@icloud.com", "app_password": "abcd-efgh-ijkl-mnop"}

    def test_first_step_returns_the_calendars_to_pick_from(self):
        with mock.patch.object(apple_calendar, "list_calendars", return_value=FAKE_CALENDARS):
            response = self.api.post("/api/integrations/apple_calendar/connect/", self.payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["needs_calendar"])
        self.assertFalse(IntegrationConnection.objects.filter(business_account=self.account).exists())

    def test_second_step_saves_an_encrypted_connection(self):
        with mock.patch.object(apple_calendar, "list_calendars", return_value=FAKE_CALENDARS):
            response = self.api.post(
                "/api/integrations/apple_calendar/connect/",
                {**self.payload, "calendar_url": FAKE_CALENDARS[0]["url"]},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        connection = IntegrationConnection.objects.get(business_account=self.account, integration="apple_calendar")
        self.assertEqual(connection.options["calendar_url"], FAKE_CALENDARS[0]["url"])
        self.assertEqual(decrypt_secrets(connection.secrets)["apple_id"], "jane@icloud.com")

    def test_a_calendar_not_on_the_list_is_refused(self):
        with mock.patch.object(apple_calendar, "list_calendars", return_value=FAKE_CALENDARS):
            response = self.api.post(
                "/api/integrations/apple_calendar/connect/",
                {**self.payload, "calendar_url": "https://somewhere-else.example/"},
                format="json",
            )
        self.assertEqual(response.status_code, 400)

    def test_a_wrong_password_gets_a_plain_message(self):
        with mock.patch.object(apple_calendar, "list_calendars", side_effect=apple_calendar.CalendarLoginError()):
            response = self.api.post("/api/integrations/apple_calendar/connect/", self.payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("didn't accept", response.json()["detail"])


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class AppleSyncTests(TestCase):
    def setUp(self):
        self.account = make_account("plus", email="sync@example.com")
        self.calendar = Calendar.objects.create(business_account=self.account, name="Main")
        self.client_record = Client.objects.create(business_account=self.account, first_name="Sam", last_name="Lee")
        self.connection = IntegrationConnection.objects.create(
            business_account=self.account,
            integration="apple_calendar",
            secrets=encrypt_secrets({"apple_id": "jane@icloud.com", "app_password": "pw"}),
            options={"calendar_url": FAKE_CALENDARS[0]["url"], "calendar_name": "Work"},
        )

    def _book(self, **overrides):
        values = {
            "business_account": self.account,
            "calendar": self.calendar,
            "client": self.client_record,
            "datetime": timezone.now() + timedelta(days=2),
            "duration_minutes": 60,
        }
        values.update(overrides)
        return Appointment.objects.create(**values)

    def test_a_new_booking_is_pushed_to_the_calendar(self):
        with mock.patch.object(apple_calendar, "save_event", return_value="https://caldav.example.test/ev/1.ics") as save:
            with self.captureOnCommitCallbacks(execute=True):
                appointment = self._book()
        self.assertEqual(save.call_count, 1)
        self.assertIsNone(save.call_args.args[3])  # no existing event yet, so it's created
        link = AppointmentSyncLink.objects.get(appointment=appointment, connection=self.connection)
        self.assertEqual(link.external_ref, "https://caldav.example.test/ev/1.ics")

    def test_a_change_updates_the_same_event(self):
        with mock.patch.object(apple_calendar, "save_event", return_value="https://caldav.example.test/ev/1.ics") as save:
            with self.captureOnCommitCallbacks(execute=True):
                appointment = self._book()
            with self.captureOnCommitCallbacks(execute=True):
                appointment.notes = "Moved to a later slot"
                appointment.save()
        self.assertEqual(save.call_args.args[3], "https://caldav.example.test/ev/1.ics")

    def test_cancelling_removes_the_event(self):
        with mock.patch.object(apple_calendar, "save_event", return_value="https://caldav.example.test/ev/1.ics"):
            with self.captureOnCommitCallbacks(execute=True):
                appointment = self._book()
        with mock.patch.object(apple_calendar, "delete_event") as delete:
            with self.captureOnCommitCallbacks(execute=True):
                appointment.status = Appointment.STATUS_CANCELLED
                appointment.save()
        delete.assert_called_once()
        self.assertFalse(AppointmentSyncLink.objects.filter(appointment=appointment).exists())

    def test_deleting_an_appointment_removes_its_event(self):
        with mock.patch.object(apple_calendar, "save_event", return_value="https://caldav.example.test/ev/9.ics"):
            with self.captureOnCommitCallbacks(execute=True):
                appointment = self._book()
        with mock.patch.object(apple_calendar, "delete_event") as delete:
            with self.captureOnCommitCallbacks(execute=True):
                appointment.delete()
        delete.assert_called_once()
        self.assertEqual(delete.call_args.args[3], "https://caldav.example.test/ev/9.ics")

    def test_a_calendar_failure_never_stops_the_booking(self):
        with mock.patch.object(apple_calendar, "save_event", side_effect=RuntimeError("Apple is down")):
            with self.captureOnCommitCallbacks(execute=True):
                appointment = self._book()
        self.assertTrue(Appointment.objects.filter(pk=appointment.pk).exists())
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, IntegrationConnection.STATUS_ERROR)
        self.assertIn("Couldn't update your calendar", self.connection.last_error)

    def test_a_successful_sync_clears_the_error(self):
        self.connection.status = IntegrationConnection.STATUS_ERROR
        self.connection.last_error = "old problem"
        self.connection.save()
        with mock.patch.object(apple_calendar, "save_event", return_value="https://caldav.example.test/ev/2.ics"):
            with self.captureOnCommitCallbacks(execute=True):
                self._book()
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, IntegrationConnection.STATUS_CONNECTED)
        self.assertEqual(self.connection.last_error, "")


class EntitlementTests(TestCase):
    def test_a_bought_integration_connects_on_basic(self):
        account = make_account("basic", email="bought@example.com")
        IntegrationEntitlement.objects.create(business_account=account, integration="zapier")
        api = APIClient()
        api.force_authenticate(user=account)
        zapier = next(i for i in api.get("/api/integrations/").json() if i["key"] == "zapier")
        self.assertEqual(zapier["access"], "owned")


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class StripeConnectTests(TestCase):
    def setUp(self):
        self.account = make_account("plus", email="stripe@example.com")
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)
        self.good = {"secret_key": "rk_test_abc123", "publishable_key": "pk_test_abc123"}

    def connect(self, payload):
        return self.api.post("/api/integrations/stripe/connect/", payload, format="json")

    def test_both_keys_are_required(self):
        self.assertEqual(self.connect({"secret_key": "rk_test_x"}).status_code, 400)

    def test_wrong_key_types_are_caught_before_calling_stripe(self):
        response = self.connect({"secret_key": "pk_test_oops", "publishable_key": "sk_test_oops"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("don't look like Stripe keys", response.json()["detail"])

    def test_test_and_live_keys_cannot_be_mixed(self):
        response = self.connect({"secret_key": "rk_test_x", "publishable_key": "pk_live_x"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("same mode", response.json()["detail"])

    def test_a_rejected_key_gets_a_plain_message(self):
        from .stripe_api import StripeError

        with mock.patch("integrations.stripe_api.check_key", side_effect=StripeError(401, "bad")):
            response = self.connect(self.good)
        self.assertEqual(response.status_code, 400)
        self.assertIn("didn't accept that key", response.json()["detail"])

    def test_a_key_without_payment_permission_is_explained(self):
        from .stripe_api import StripeError

        with mock.patch("integrations.stripe_api.check_key", side_effect=StripeError(403, "no")):
            response = self.connect(self.good)
        self.assertIn("read and write payments", response.json()["detail"])

    def test_a_good_key_saves_encrypted_and_records_the_mode(self):
        with mock.patch("integrations.stripe_api.check_key", return_value={"data": []}):
            response = self.connect(self.good)
        self.assertEqual(response.status_code, 201)
        connection = IntegrationConnection.objects.get(business_account=self.account, integration="stripe")
        self.assertEqual(connection.options["mode"], "test")
        self.assertNotIn("rk_test_abc123", connection.secrets)
        self.assertEqual(decrypt_secrets(connection.secrets)["secret_key"], "rk_test_abc123")

    def test_real_stripe_rejects_a_fake_key(self):
        # No mocking here: this asks Stripe itself, so it proves the wrapper talks to the real API.
        response = self.connect({"secret_key": "rk_test_fake_not_real", "publishable_key": "pk_test_fake_not_real"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("didn't accept that key", response.json()["detail"])


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class DemoModeTests(TestCase):
    # Per Mako: a demo account gets the full experience except processing real
    # money. Connecting a payment processor is blocked until he activates the
    # account by hand; everything else (calendars, Zapier, Slack, Mailchimp)
    # is untouched by this, since only the "Payments" category is gated here.
    def setUp(self):
        self.account = make_account("plus", email="demo@example.com", subscription_status="trialing")
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def test_a_demo_account_cannot_connect_stripe(self):
        response = self.api.post(
            "/api/integrations/stripe/connect/",
            {"secret_key": "rk_test_x", "publishable_key": "pk_test_x"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("demo account", response.json()["detail"])
        self.assertFalse(IntegrationConnection.objects.filter(business_account=self.account, integration="stripe").exists())

    def test_an_activated_account_can_connect_stripe(self):
        self.account.subscription_status = BusinessAccount.STATUS_ACTIVE
        self.account.save(update_fields=["subscription_status"])
        with mock.patch("integrations.stripe_api.check_key", return_value={"data": []}):
            response = self.api.post(
                "/api/integrations/stripe/connect/",
                {"secret_key": "rk_test_x", "publishable_key": "pk_test_x"},
                format="json",
            )
        self.assertEqual(response.status_code, 201)

    def test_a_demo_account_can_still_connect_a_non_payment_integration(self):
        # Apple Calendar - free on every plan, nothing to buy - proves the block
        # above is specific to "Payments", not a blanket lockout of everything.
        with mock.patch.object(apple_calendar, "list_calendars", return_value=FAKE_CALENDARS):
            response = self.api.post(
                "/api/integrations/apple_calendar/connect/",
                {"apple_id": "jane@icloud.com", "app_password": "abcd-efgh-ijkl-mnop", "calendar_url": FAKE_CALENDARS[0]["url"]},
                format="json",
            )
        self.assertEqual(response.status_code, 201, response.content)


class GuideCompletenessTests(TestCase):
    # Owners have no support team to call, so every guide has to be complete.
    # These tests stop a half-written guide from ever reaching the store.
    # These always need content. can_do and coming_next can honestly be empty (an
    # integration that's not built has nothing to do yet), so they only have to exist.
    REQUIRED_LISTS = ["before_you_start", "setup", "cannot_do", "problems"]
    OPTIONAL_LISTS = ["can_do", "coming_next", "help"]

    def all_text(self, guide):
        parts = [guide["right_now"]]
        for key in ["before_you_start", "can_do", "cannot_do", "coming_next"]:
            parts.extend(guide[key])
        for step in guide["setup"]:
            parts.append(step["title"])
            parts.extend(step["details"])
        for section in guide["help"]:
            parts.append(section["title"])
            parts.extend(section["items"])
        for problem in guide["problems"]:
            parts.extend([problem["problem"], problem["fix"]])
        return parts

    def test_every_guide_has_every_section(self):
        for entry in CATALOG:
            guide = entry["guide"]
            for key in self.REQUIRED_LISTS:
                self.assertTrue(guide[key], f"{entry['key']} is missing {key}")
            for key in self.OPTIONAL_LISTS:
                self.assertIn(key, guide, f"{entry['key']} is missing {key}")
            self.assertTrue(guide["right_now"], f"{entry['key']} needs a right_now line")

    def test_steps_have_titles_and_details(self):
        for entry in CATALOG:
            for step in entry["guide"]["setup"]:
                self.assertTrue(step["title"], entry["key"])
                self.assertTrue(step["details"], f"{entry['key']} step '{step['title']}' has no detail")

    def test_no_dashes_in_customer_wording(self):
        for entry in CATALOG:
            for text in self.all_text(entry["guide"]):
                self.assertNotIn("—", text, f"em dash in {entry['key']}: {text}")
                self.assertNotIn("–", text, f"en dash in {entry['key']}: {text}")

    def test_card_processors_tell_basic_owners_to_upgrade(self):
        for key in ("stripe", "square", "clover"):
            text = " ".join(find(key)["guide"]["before_you_start"])
            self.assertIn("upgrade to Plus", text, key)


@override_settings(INTEGRATION_ENCRYPTION_KEY=TEST_KEY)
class OutboundEventTests(TestCase):
    """Slack, Zapier, and Mailchimp: what gets sent, when, and what happens when it fails."""

    def setUp(self):
        from clients.models import Client as ClientModel
        from scheduling.models import Calendar as CalendarModel
        from invoicing.models import TenderType as TenderModel
        from services.models import Service as ServiceModel

        self.account = make_account("premium", email="events@example.com")
        self.client_record = ClientModel.objects.create(business_account=self.account, first_name="Ana", last_name="Diaz")
        self.calendar = CalendarModel.objects.create(business_account=self.account, name="Main")
        self.service = ServiceModel.objects.create(business_account=self.account, name="Haircut", price=Decimal("40"), is_taxable=False)
        self.cash = TenderModel.objects.get(name="Cash", business_account=None)

    def connect(self, key, secrets, options=None):
        return IntegrationConnection.objects.create(
            business_account=self.account, integration=key,
            secrets=encrypt_secrets(secrets), options=options or {},
        )

    def book(self):
        return Appointment.objects.create(
            business_account=self.account, calendar=self.calendar, client=self.client_record,
            service=self.service, datetime=timezone.now() + timedelta(days=1), duration_minutes=60,
        )

    def test_a_booking_goes_to_zapier(self):
        self.connect("zapier", {"webhook_url": "https://hooks.zapier.com/hooks/catch/1/abc/"})
        with mock.patch("integrations.events.post_json") as post, self.captureOnCommitCallbacks(execute=True):
            self.book()
        payload = post.call_args.args[1]
        self.assertEqual(payload["event"], "appointment.booked")
        self.assertEqual(payload["data"]["client"], "Ana Diaz")
        self.assertEqual(payload["data"]["service"], "Haircut")

    def test_a_booking_is_posted_to_slack_in_plain_words(self):
        self.connect("slack", {"webhook_url": "https://hooks.slack.com/services/T/B/x"})
        with mock.patch("integrations.events.post_json") as post, self.captureOnCommitCallbacks(execute=True):
            self.book()
        self.assertIn("New booking: Haircut with Ana Diaz", post.call_args.args[1]["text"])

    def test_a_paid_invoice_is_posted_to_slack(self):
        from invoicing.models import Invoice, InvoiceLineItem

        self.connect("slack", {"webhook_url": "https://hooks.slack.com/services/T/B/x"})
        invoice = Invoice.objects.create(business_account=self.account, client=self.client_record, invoice_number="INV-EV1", status=Invoice.STATUS_UNPAID)
        InvoiceLineItem.objects.create(invoice=invoice, service=self.service, quantity=1, unit_price=Decimal("40"))
        api = APIClient()
        api.force_authenticate(user=self.account)
        # Pay through the same endpoint the app uses, since that's what marks the invoice paid.
        with mock.patch("integrations.events.post_json") as post, self.captureOnCommitCallbacks(execute=True):
            response = api.post("/api/invoicing/payments/", {"client": self.client_record.pk, "invoice": invoice.pk, "tender_type": self.cash.pk, "amount": "40.00", "is_refund": False}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        texts = [call.args[1]["text"] for call in post.call_args_list]
        self.assertTrue(any("Paid: invoice INV-EV1 from Ana Diaz for $40.00" in t for t in texts))

    def test_a_new_client_is_added_to_mailchimp_as_pending(self):
        self.connect("mailchimp", {"api_key": "abc123-us21"}, {"audience_id": "aud1"})
        with mock.patch("integrations.events.add_to_audience") as add, self.captureOnCommitCallbacks(execute=True):
            from clients.models import Client as ClientModel
            ClientModel.objects.create(business_account=self.account, first_name="New", last_name="Person", email="new@example.com")
        add.assert_called_once()
        self.assertEqual(add.call_args.args[:2], ("abc123-us21", "aud1"))

    def test_a_failed_send_never_blocks_the_booking(self):
        from .outbound import OutboundError

        self.connect("zapier", {"webhook_url": "https://hooks.zapier.com/hooks/catch/1/abc/"})
        with mock.patch("integrations.events.post_json", side_effect=OutboundError("down")), self.captureOnCommitCallbacks(execute=True):
            appointment = self.book()
        self.assertTrue(Appointment.objects.filter(pk=appointment.pk).exists())
        connection = IntegrationConnection.objects.get(business_account=self.account, integration="zapier")
        self.assertEqual(connection.status, IntegrationConnection.STATUS_ERROR)
        self.assertEqual(connection.last_error, "down")

    def test_slack_refuses_a_link_that_is_not_slack(self):
        response = APIClient()
        response.force_authenticate(user=self.account)
        result = response.post("/api/integrations/slack/connect/", {"webhook_url": "https://example.com/x"}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertIn("hooks.slack.com", result.json()["detail"])

    def test_zapier_connect_sends_a_test_then_saves(self):
        api = APIClient()
        api.force_authenticate(user=self.account)
        with mock.patch("integrations.views.post_json") as post:
            result = api.post("/api/integrations/zapier/connect/", {"webhook_url": "https://hooks.zapier.com/hooks/catch/9/zz/"}, format="json")
        self.assertEqual(result.status_code, 201, result.content)
        self.assertEqual(post.call_args.args[1]["event"], "mellax.connected")
        self.assertEqual(IntegrationConnection.objects.get(business_account=self.account, integration="zapier").status, "connected")

    def test_mailchimp_connect_checks_the_key_first(self):
        from .outbound import OutboundError

        api = APIClient()
        api.force_authenticate(user=self.account)
        with mock.patch("integrations.views.check_mailchimp", side_effect=OutboundError("Mailchimp didn't accept that API key.")):
            result = api.post("/api/integrations/mailchimp/connect/", {"api_key": "bad-us21", "audience_id": "aud1"}, format="json")
        self.assertEqual(result.status_code, 400)
        self.assertFalse(IntegrationConnection.objects.filter(business_account=self.account, integration="mailchimp").exists())
