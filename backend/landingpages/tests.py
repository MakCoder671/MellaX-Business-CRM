import importlib

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import BusinessAccount

from .models import LandingPage


# Every account should end up with exactly one landing page, however it was
# created. These tests cover the ways an account can appear.
class EveryAccountGetsALandingPageTests(TestCase):
    def test_creating_an_account_directly_makes_its_page(self):
        account = BusinessAccount.objects.create_user(
            email="direct@example.com", business_name="Jane's Lawn Care", password="testpass123"
        )
        page = LandingPage.objects.get(business_account=account)
        self.assertEqual(page.slug, "janes-lawn-care")

    def test_signup_endpoint_makes_exactly_one_page(self):
        response = APIClient().post(
            "/api/accounts/signup/",
            {
                "email": "signup@example.com",
                "business_name": "Signup Barbers",
                "password": "testpass123",
                "accept_tos": True,
                "plan_tier": "basic",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        account = BusinessAccount.objects.get(email="signup@example.com")
        self.assertEqual(LandingPage.objects.filter(business_account=account).count(), 1)

    def test_two_businesses_with_the_same_name_get_different_addresses(self):
        first = BusinessAccount.objects.create_user(email="one@example.com", business_name="Main Street Cuts", password="testpass123")
        second = BusinessAccount.objects.create_user(email="two@example.com", business_name="Main Street Cuts", password="testpass123")
        self.assertEqual(LandingPage.objects.get(business_account=first).slug, "main-street-cuts")
        self.assertEqual(LandingPage.objects.get(business_account=second).slug, "main-street-cuts-2")

    def test_editing_an_account_never_adds_a_second_page(self):
        account = BusinessAccount.objects.create_user(email="edit@example.com", business_name="Edit Co", password="testpass123")
        account.business_name = "Edit Company"
        account.save()
        self.assertEqual(LandingPage.objects.filter(business_account=account).count(), 1)
        self.assertEqual(LandingPage.objects.get(business_account=account).slug, "edit-co")

    def test_the_new_page_is_reachable_on_the_public_link(self):
        account = BusinessAccount.objects.create_user(email="public@example.com", business_name="Public Pizza", password="testpass123")
        slug = LandingPage.objects.get(business_account=account).slug
        response = APIClient().get(f"/api/landing-pages/public/{slug}/")
        self.assertEqual(response.status_code, 200)

    def test_backfill_gives_a_page_to_an_account_that_has_none(self):
        account = BusinessAccount.objects.create_user(email="old@example.com", business_name="Old School Shop", password="testpass123")
        LandingPage.objects.filter(business_account=account).delete()  # pretend it was made before the feature existed

        backfill = importlib.import_module("landingpages.migrations.0007_backfill_landing_pages")
        from django.apps import apps

        backfill.create_missing_landing_pages(apps, None)

        self.assertEqual(LandingPage.objects.get(business_account=account).slug, "old-school-shop")
