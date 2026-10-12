import json
from io import BytesIO
from unittest import mock

from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.test import TestCase, override_settings

from .email_backend import ResendBackend
from .email_images import attach_inline_image


def _fake_response(body=b"{}"):
    # Minimal stand-in for what urlopen(...) gives back from a `with` block -
    # just enough for the backend's `response.read()` to work.
    resp = mock.MagicMock()
    resp.read.return_value = body
    resp.__enter__.return_value = resp
    return resp


@override_settings(EMAIL_HOST_PASSWORD="re_test_key", DEFAULT_FROM_EMAIL="MellaX <onboarding@resend.dev>")
class ResendBackendTests(TestCase):
    def test_sends_a_plain_text_email_with_the_right_payload(self):
        message = EmailMessage("Verify your account", "Click this link.", to=["owner@example.com"])
        with mock.patch("common.email_backend.urllib.request.urlopen", return_value=_fake_response()) as urlopen:
            sent = ResendBackend().send_messages([message])
        self.assertEqual(sent, 1)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(request.get_header("Authorization"), "Bearer re_test_key")
        payload = json.loads(request.data)
        self.assertEqual(payload["to"], ["owner@example.com"])
        self.assertEqual(payload["subject"], "Verify your account")
        self.assertEqual(payload["text"], "Click this link.")
        self.assertEqual(payload["from"], "MellaX <onboarding@resend.dev>")
        self.assertNotIn("html", payload)

    def test_carries_over_the_html_alternative(self):
        message = EmailMultiAlternatives("Spring Sale", "Plain version", to=["client@example.com"])
        message.attach_alternative("<p>Spring Sale</p>", "text/html")
        with mock.patch("common.email_backend.urllib.request.urlopen", return_value=_fake_response()) as urlopen:
            ResendBackend().send_messages([message])
        payload = json.loads(urlopen.call_args.args[0].data)
        self.assertEqual(payload["html"], "<p>Spring Sale</p>")

    def test_an_inline_logo_image_keeps_its_content_id(self):
        from django.core.files.base import ContentFile

        message = EmailMultiAlternatives("Newsletter", "text", to=["client@example.com"])
        message.attach_alternative("<img src='cid:logo'>", "text/html")
        attach_inline_image(message, ContentFile(b"fake-png-bytes", name="logo.png"), "logo")

        with mock.patch("common.email_backend.urllib.request.urlopen", return_value=_fake_response()) as urlopen:
            ResendBackend().send_messages([message])
        payload = json.loads(urlopen.call_args.args[0].data)
        self.assertEqual(len(payload["attachments"]), 1)
        self.assertEqual(payload["attachments"][0]["content_id"], "logo")
        self.assertEqual(payload["attachments"][0]["filename"], "logo.png")

    def test_a_failed_send_raises_instead_of_silently_losing_the_email(self):
        import urllib.error

        message = EmailMessage("Hi", "body", to=["owner@example.com"])
        error = urllib.error.HTTPError("url", 401, "unauthorized", {}, BytesIO(b'{"message": "bad key"}'))
        with mock.patch("common.email_backend.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(RuntimeError):
                ResendBackend().send_messages([message])

    def test_fail_silently_swallows_the_error(self):
        import urllib.error

        message = EmailMessage("Hi", "body", to=["owner@example.com"])
        error = urllib.error.HTTPError("url", 401, "unauthorized", {}, BytesIO(b"{}"))
        with mock.patch("common.email_backend.urllib.request.urlopen", side_effect=error):
            sent = ResendBackend(fail_silently=True).send_messages([message])
        self.assertEqual(sent, 0)
