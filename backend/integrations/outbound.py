import base64
import hashlib
import json
import ssl
import urllib.error
import urllib.request

import certifi

# ----------------------------------------------------------------------------
# Sends data OUT to the tools an owner connects: Slack, Zapier, and Mailchimp.
# Everything here is one way. MellaX sends, and nothing comes back.
# ----------------------------------------------------------------------------

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
TIMEOUT_SECONDS = 10


class OutboundError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def post_json(url, payload, headers=None):
    data = json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        raise OutboundError(f"The other app said no ({exc.code}). Check the link is still active.") from exc
    except urllib.error.URLError as exc:
        raise OutboundError("We couldn't reach the other app right now.") from exc


def mailchimp_request(api_key, method, path, payload=None):
    # Mailchimp keys end in a data-center code, like "-us21", and that code is the server to call.
    if "-" not in api_key:
        raise OutboundError("That doesn't look like a Mailchimp API key. It ends in something like -us21.")
    data_center = api_key.rsplit("-", 1)[1]
    url = f"https://{data_center}.api.mailchimp.com/3.0/{path}"
    token = base64.b64encode(f"anystring:{api_key}".encode()).decode()
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, method=method)
    request.add_header("Authorization", f"Basic {token}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise OutboundError("Mailchimp didn't accept that API key. Copy the whole key again.") from exc
        if exc.code == 404:
            raise OutboundError("Mailchimp couldn't find that audience. Check the Audience ID.") from exc
        raise OutboundError(f"Mailchimp said no ({exc.code}).") from exc
    except urllib.error.URLError as exc:
        raise OutboundError("We couldn't reach Mailchimp right now.") from exc


def add_to_audience(api_key, audience_id, email, first_name="", last_name=""):
    # Mailchimp rules: only add people who agreed to hear from you. "pending" makes Mailchimp
    # send a confirmation email, so the person has to say yes before they're on the list.
    member_hash = hashlib.md5(email.lower().encode()).hexdigest()
    mailchimp_request(api_key, "PUT", f"lists/{audience_id}/members/{member_hash}", {
        "email_address": email,
        "status_if_new": "pending",
        "merge_fields": {"FNAME": first_name, "LNAME": last_name},
    })


def check_mailchimp(api_key, audience_id):
    mailchimp_request(api_key, "GET", "ping")
    mailchimp_request(api_key, "GET", f"lists/{audience_id}?fields=id")
