from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import BusinessAccount


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
