import base64
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request

import certifi

# ----------------------------------------------------------------------------
# A small wrapper around Stripe's API, using only Python's standard library so
# there's nothing extra to install. Every call uses the owner's own key, so the
# money goes straight to their Stripe account.
# ----------------------------------------------------------------------------

STRIPE_API = "https://api.stripe.com/v1/"
TIMEOUT_SECONDS = 20
# Some Python installs (python.org builds on a Mac, for example) don't ship with the
# certificate authorities. certifi brings its own, so HTTPS to Stripe always verifies.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


class StripeError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def request(api_key, method, path, params=None):
    url = STRIPE_API + path
    data = None
    if params is not None and method == "GET":
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    elif params is not None:
        data = urllib.parse.urlencode(params, doseq=True).encode()

    req = urllib.request.Request(url, data=data, method=method)
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS, context=SSL_CONTEXT) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
            message = body.get("error", {}).get("message", "")
        except Exception:
            message = ""
        raise StripeError(exc.code, message or "Stripe didn't answer as expected.") from exc
    except urllib.error.URLError as exc:
        raise StripeError(0, "We couldn't reach Stripe right now. Try again in a few minutes.") from exc


def check_key(api_key):
    """Asks Stripe for one payment, which proves the key works and can read payments."""
    return request(api_key, "GET", "payment_intents", {"limit": 1})
