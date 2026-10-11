from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import BusinessAccount, SupportRequest


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_signup_and_login_require_email_verification(self):
        signup_response = self.client.post(
            reverse("signup"),
            {
                "email": "owner@example.com",
                "business_name": "Acme Co.",
                "password": "securepass123",
                "accept_tos": True,
                "plan_tier": BusinessAccount.PLAN_BASIC,
            },
            format="json",
        )

        self.assertEqual(signup_response.status_code, 201)

        account = BusinessAccount.objects.get(email="owner@example.com")
        self.assertFalse(account.is_email_verified)

        login_response = self.client.post(
            reverse("login"),
            {"email": "owner@example.com", "password": "securepass123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 400)

        account.is_email_verified = True
        account.save(update_fields=["is_email_verified"])

        verified_login_response = self.client.post(
            reverse("login"),
            {"email": "owner@example.com", "password": "securepass123"},
            format="json",
        )
        self.assertEqual(verified_login_response.status_code, 200)
        self.assertIn("token", verified_login_response.data)
        self.assertIn("account", verified_login_response.data)

    def test_me_endpoint_returns_current_account(self):
        account = BusinessAccount.objects.create_user(
            email="owner2@example.com",
            business_name="Beta Business",
            password="securepass123",
            is_email_verified=True,
        )
        token, _ = Token.objects.get_or_create(user=account)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], account.email)
        self.assertEqual(response.data["business_name"], account.business_name)


class SubscriptionTests(TestCase):
    def setUp(self):
        self.account = BusinessAccount.objects.create_user(
            email="owner@example.com", business_name="Acme Co.", password="securepass123",
            is_email_verified=True, plan_tier=BusinessAccount.PLAN_BASIC,
        )
        self.client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.account)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_new_account_starts_on_a_five_day_demo(self):
        self.assertEqual(self.account.subscription_status, BusinessAccount.STATUS_TRIALING)
        self.assertEqual(self.account.trial_days_left(), 5)

    def test_subscription_endpoint_reports_plan_and_trial(self):
        response = self.client.get(reverse("subscription"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_tier"], "basic")
        self.assertEqual(response.data["trial_days_left"], 5)

    def test_changing_plan_takes_effect_immediately(self):
        response = self.client.post(reverse("change-plan"), {"plan_tier": "plus"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.account.refresh_from_db()
        self.assertEqual(self.account.plan_tier, BusinessAccount.PLAN_PLUS)

    def test_changing_plan_rejects_anything_but_basic_or_plus(self):
        response = self.client.post(reverse("change-plan"), {"plan_tier": "premium"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_canceling_locks_the_account_out_right_away(self):
        response = self.client.post(reverse("cancel-subscription"), {}, format="json")
        self.assertEqual(response.status_code, 200)

        self.account.refresh_from_db()
        self.assertEqual(self.account.subscription_status, BusinessAccount.STATUS_CANCELED)
        self.assertIsNotNone(self.account.canceled_at)
        self.assertFalse(self.account.is_active)
        self.assertFalse(Token.objects.filter(user=self.account).exists())

        # The very next request with the now-deleted token is refused, same as any bad token
        # (403, not 401 - this project doesn't configure a WWW-Authenticate challenge, so DRF's
        # default "not authenticated" response is 403 here, same as every other protected endpoint).
        locked_out = self.client.get(reverse("me"))
        self.assertEqual(locked_out.status_code, 403)

    @override_settings(OWNER_NOTIFY_EMAIL="mako@example.com")
    def test_canceling_emails_the_owner(self):
        with mock.patch("accounts.views.EmailMessage") as email_cls:
            self.client.post(reverse("cancel-subscription"), {}, format="json")
        email_cls.assert_called_once()
        self.assertIn("mako@example.com", email_cls.call_args.kwargs["to"])

    def test_without_an_owner_email_configured_nothing_is_sent(self):
        # OWNER_NOTIFY_EMAIL defaults to "" in tests, so this should just quietly skip sending.
        with mock.patch("accounts.views.EmailMessage") as email_cls:
            response = self.client.post(reverse("cancel-subscription"), {}, format="json")
        self.assertEqual(response.status_code, 200)
        email_cls.assert_not_called()


class SupportRequestTests(TestCase):
    def setUp(self):
        self.account = BusinessAccount.objects.create_user(
            email="owner3@example.com", business_name="Gamma LLC", password="securepass123", is_email_verified=True,
        )
        self.client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.account)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_submitting_a_support_request_saves_it_under_this_account(self):
        response = self.client.post(
            reverse("support-request-list"),
            {"category": "feature", "message": "Add a dark mode please."},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        request_obj = SupportRequest.objects.get()
        self.assertEqual(request_obj.business_account, self.account)
        self.assertEqual(request_obj.category, "feature")

    def test_blank_message_is_refused(self):
        response = self.client.post(
            reverse("support-request-list"), {"category": "bug", "message": "   "}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_an_account_only_sees_its_own_requests(self):
        other = BusinessAccount.objects.create_user(
            email="other@example.com", business_name="Other Co.", password="securepass123", is_email_verified=True,
        )
        SupportRequest.objects.create(business_account=other, category="question", message="Not yours")
        SupportRequest.objects.create(business_account=self.account, category="question", message="Mine")

        response = self.client.get(reverse("support-request-list"))
        self.assertEqual(response.status_code, 200)
        messages = [row["message"] for row in response.data]
        self.assertEqual(messages, ["Mine"])

    @override_settings(OWNER_NOTIFY_EMAIL="mako@example.com")
    def test_submitting_emails_the_owner_with_reply_to_the_business(self):
        with mock.patch("accounts.views.EmailMessage") as email_cls:
            self.client.post(
                reverse("support-request-list"),
                {"category": "billing", "message": "Can I get a refund?"},
                format="json",
            )
        email_cls.assert_called_once()
        self.assertEqual(email_cls.call_args.kwargs["reply_to"], [self.account.email])
