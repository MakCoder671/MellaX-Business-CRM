from django.test import TestCase

# Create your tests here.


import io  # noqa: E402

from django.core.files.uploadedfile import SimpleUploadedFile  # noqa: E402
from django.test import TestCase  # noqa: E402
from clients.models import Client  # noqa: E402
from PIL import Image  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from accounts.models import BusinessAccount  # noqa: E402
from campaigns.models import Campaign  # noqa: E402

from .models import EBlast, MarketingTemplate  # noqa: E402


def png_bytes(size=(600, 300)):
    buffer = io.BytesIO()
    Image.new("RGB", size, (16, 185, 129)).save(buffer, format="PNG")
    return buffer.getvalue()


class TemplateTests(TestCase):
    def setUp(self):
        self.account = BusinessAccount.objects.create_user(email="mkt@example.com", business_name="Mkt Co", password="testpass123")
        self.other = BusinessAccount.objects.create_user(email="mkt2@example.com", business_name="Other Co", password="testpass123")
        self.api = APIClient()
        self.api.force_authenticate(user=self.account)

    def upload(self, data=None, content_type="image/png", name="spring.png", canva="https://www.canva.com/design/DAFabc/view"):
        image = SimpleUploadedFile(name, data or png_bytes(), content_type=content_type)
        return self.api.post("/api/marketing/templates/", {"name": "Spring sale", "image": image, "canva_link": canva}, format="multipart")

    def test_upload_a_png_from_canva(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()["image_url"].startswith("http"))
        self.assertEqual(MarketingTemplate.objects.for_account(self.account).count(), 1)

    def test_only_png_jpg_or_webp_is_accepted(self):
        pdf = b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"
        response = self.upload(data=pdf, content_type="application/pdf", name="flyer.pdf")
        self.assertEqual(response.status_code, 400)

    def test_the_link_must_be_a_canva_link(self):
        response = self.upload(canva="https://example.com/design")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Canva", str(response.json()))

    def test_templates_are_private_to_each_business(self):
        self.upload()
        other_api = APIClient()
        other_api.force_authenticate(user=self.other)
        self.assertEqual(other_api.get("/api/marketing/templates/").json(), [])

    def test_an_eblast_can_use_a_template_and_the_email_shows_it(self):
        import tempfile

        from django.core import mail
        from django.test import override_settings

        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            template = MarketingTemplate.objects.create(
                business_account=self.account, name="Spring",
                image=SimpleUploadedFile("spring.png", png_bytes(), content_type="image/png"),
            )
            Client.objects.create(business_account=self.account, first_name="Mail", last_name="Test", email="client@example.com")
            response = self.api.post("/api/marketing/eblasts/", {"subject": "Hi", "body": "Come see us", "template": template.pk}, format="json")
            eblast_id = response.json()["id"]
            send = self.api.post(f"/api/marketing/eblasts/{eblast_id}/send/", {}, format="json")
            self.assertEqual(send.status_code, 200, send.content)

        message = mail.outbox[-1]
        html = message.alternatives[0][0]
        self.assertIn('src="cid:mellax-design"', html)  # the image is referenced inside the email...
        cids = [part.get("Content-ID") for part in message.attachments if hasattr(part, "get")]
        self.assertIn("<mellax-design>", cids)  # ...and attached to it, so no public address is needed
        self.assertNotIn("http://127.0.0.1", html)

    def test_an_eblast_cannot_use_another_businesses_template(self):
        theirs = MarketingTemplate.objects.create(business_account=self.other, name="Theirs", image="marketing_templates/t.png")
        response = self.api.post("/api/marketing/eblasts/", {"subject": "Hi", "body": "x", "template": theirs.pk}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_a_campaign_shows_its_template_on_the_public_page(self):
        template = MarketingTemplate.objects.create(business_account=self.account, name="Flyer", image="marketing_templates/flyer.png")
        campaign = Campaign.objects.create(business_account=self.account, name="Summer", share_link_slug="summer-test", template=template)
        public = APIClient().get(f"/api/campaigns/public/{campaign.share_link_slug}/").json()
        self.assertIn("marketing_templates/flyer.png", public["template_image"])

    def test_deleting_a_template_keeps_the_eblast(self):
        template = MarketingTemplate.objects.create(business_account=self.account, name="Gone", image="marketing_templates/g.png")
        eblast = EBlast.objects.create(business_account=self.account, subject="s", body="b", template=template)
        template.delete()
        eblast.refresh_from_db()
        self.assertIsNone(eblast.template)
