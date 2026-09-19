from django.contrib.auth.tokens import PasswordResetTokenGenerator

# ----------------------------------------------------------------------------
# Django already ships with a "password reset token" system
# (PasswordResetTokenGenerator + default_token_generator) — it makes a
# signed, tamper-proof, time-limited token without storing anything extra
# in the database. We're reusing that exact same mechanism for EMAIL
# VERIFICATION links too, since the two problems are basically identical:
# "prove this person clicked a link we emailed them, and make sure the
# link expires / can't be reused after it's already been used."
#
# The only thing we change is the `key_salt` — that's what keeps a
# verification link from accidentally working as a password-reset link
# (and vice versa), since the salt gets mixed into the token's hash.
# ----------------------------------------------------------------------------


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "accounts.EmailVerificationTokenGenerator"

    def _make_hash_value(self, account, timestamp):
        # This is the data that gets hashed to produce the token. Including
        # `is_email_verified` means that once someone verifies their email,
        # their OLD verification link stops working (the hash changes),
        # so it can't be reused later.
        return f"{account.pk}{account.is_email_verified}{timestamp}"


# One shared instance, imported wherever we need to make or check a token.
email_verification_token = EmailVerificationTokenGenerator()
