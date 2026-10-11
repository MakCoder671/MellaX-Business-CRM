import base64
import hashlib
import json

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# ----------------------------------------------------------------------------
# Owners paste third-party keys and passwords into MellaX. Those get stored
# encrypted, so a leaked database dump doesn't hand over working credentials.
# The key comes from INTEGRATION_ENCRYPTION_KEY. Keep that key safe: lose it and
# every saved connection has to be set up again.
# ----------------------------------------------------------------------------


def _fernet():
    key = settings.INTEGRATION_ENCRYPTION_KEY
    if not key:
        if not settings.DEBUG:
            raise ImproperlyConfigured(
                "Set INTEGRATION_ENCRYPTION_KEY in the environment before connecting integrations."
            )
        # Local development only: derive a stable key from SECRET_KEY so local
        # runs work without extra setup. Production always uses its own key.
        digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key.encode())


def encrypt_secrets(data):
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_secrets(token):
    return json.loads(_fernet().decrypt(token.encode()).decode())
