from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import BusinessAccount
from clients.models import Client


class ClientTenantIsolationTests(TestCase):
    def setUp(self):
        self.account_one = BusinessAccount.objects.create_user(
            email="alpha@example.com",
            business_name="Alpha Co.",
            password="securepass123",
            is_email_verified=True,
        )
        self.account_two = BusinessAccount.objects.create_user(
            email="beta@example.com",
            business_name="Beta Co.",
            password="securepass123",
            is_email_verified=True,
        )

        self.client_one = APIClient()
        self.client_two = APIClient()

        token_one, _ = Token.objects.get_or_create(user=self.account_one)
        token_two, _ = Token.objects.get_or_create(user=self.account_two)

        self.client_one.credentials(HTTP_AUTHORIZATION=f"Token {token_one.key}")
        self.client_two.credentials(HTTP_AUTHORIZATION=f"Token {token_two.key}")

        self.client_for_account_one = Client.objects.create(
            business_account=self.account_one,
            first_name="Alice",
            last_name="Alpha",
            email="alice@alpha.example",
            phone="555-1000",
        )

    def test_list_only_returns_current_account_clients(self):
        response_one = self.client_one.get(reverse("client-list"))
        response_two = self.client_two.get(reverse("client-list"))

        self.assertEqual(response_one.status_code, 200)
        self.assertEqual(response_two.status_code, 200)
        self.assertEqual(len(response_one.data), 1)
        self.assertEqual(len(response_two.data), 0)

    def test_detail_endpoint_rejects_other_account_client(self):
        response = self.client_two.get(reverse("client-detail", args=[self.client_for_account_one.pk]))

        self.assertEqual(response.status_code, 404)
