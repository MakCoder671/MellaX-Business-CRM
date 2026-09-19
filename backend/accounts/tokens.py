from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Same HMAC-signed, time-limited scheme as password reset, salted
    differently so an email-verification link can't double as a password
    reset link and vice versa."""

    key_salt = "accounts.EmailVerificationTokenGenerator"

    def _make_hash_value(self, account, timestamp):
        return f"{account.pk}{account.is_email_verified}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()
