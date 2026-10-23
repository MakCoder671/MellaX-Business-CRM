import base64
import json
import ssl
import urllib.error
import urllib.request
from email.mime.base import MIMEBase

import certifi
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

# ----------------------------------------------------------------------------
# Sends email through Resend's HTTP API instead of SMTP. This exists because
# some hosts (Render's free tier, for one) silently block outbound SMTP
# (port 587/465) - a connection attempt just hangs until a long OS-level
# timeout instead of failing fast, which is what made signup hang/500 the
# first time email was wired up here. A plain HTTPS POST, like every other
# API call this app already makes (Stripe, Mailchimp, ...), isn't blocked.
#
# Reuses EMAIL_HOST_PASSWORD as the Resend API key - that's the env var
# that's already set on the real deployment, so switching to this backend
# is just changing EMAIL_BACKEND, not re-entering the key under a new name.
#
# Same interface as Django's built-in SMTP/console backends (see
# django.core.mail.backends.base.BaseEmailBackend), so swapping EMAIL_BACKEND
# to "common.email_backend.ResendBackend" is the only change needed anywhere
# that sends email (accounts/views.py, marketing/views.py, ...).
# ----------------------------------------------------------------------------

RESEND_API = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 15
# Some Python installs don't ship their own certificate authorities - certifi
# brings its own, so this always verifies the connection properly.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


class ResendBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        sent = 0
        for message in email_messages:
            try:
                self._send_one(message)
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent

    def _send_one(self, message):
        payload = {
            "from": message.from_email or settings.DEFAULT_FROM_EMAIL,
            "to": list(message.to),
            "subject": message.subject,
            "text": message.body,
        }
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.bcc:
            payload["bcc"] = list(message.bcc)
        if message.reply_to:
            payload["reply_to"] = list(message.reply_to)

        # EmailMultiAlternatives (the marketing e-blasts) carries the HTML
        # version as an "alternative" alongside the plain text body above.
        for content, mimetype in getattr(message, "alternatives", []):
            if mimetype == "text/html":
                payload["html"] = content

        attachments = _resend_attachments(message)
        if attachments:
            payload["attachments"] = attachments

        req = urllib.request.Request(
            RESEND_API,
            data=json.dumps(payload).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {settings.EMAIL_HOST_PASSWORD}",
                "Content-Type": "application/json",
                # Resend's API sits behind Cloudflare, which blocks Python's
                # default "Python-urllib/x.y" User-Agent outright (403,
                # "error code: 1010"). Any real, named User-Agent gets through.
                "User-Agent": "MellaX/1.0 (+https://mellax-business-crm-ri.vercel.app)",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
                response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise RuntimeError(f"Resend refused that email ({exc.code}): {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError("Couldn't reach Resend right now.") from exc


def _resend_attachments(message):
    # message.attachments is a mixed bag: plain (filename, content, mimetype)
    # tuples from the normal message.attach(...) calls, OR a raw MIME part
    # object for an inline image attached the other way Django allows (see
    # common/email_images.py's attach_inline_image) - those need their
    # Content-ID carried over so Resend can match it to the "cid:..." the
    # HTML already references.
    attachments = []
    for attachment in message.attachments:
        if isinstance(attachment, MIMEBase):
            content_id = (attachment.get("Content-ID") or "").strip("<>")
            data = attachment.get_payload(decode=True) or b""
            entry = {
                "filename": attachment.get_filename() or content_id or "image",
                "content": base64.b64encode(data).decode(),
            }
            if content_id:
                entry["content_id"] = content_id
            attachments.append(entry)
        else:
            filename, content, _mimetype = attachment
            if isinstance(content, str):
                content = content.encode()
            attachments.append({"filename": filename, "content": base64.b64encode(content).decode()})
    return attachments
