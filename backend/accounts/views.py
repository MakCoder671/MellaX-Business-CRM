from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import BusinessAccount
from .serializers import BusinessAccountSerializer, LoginSerializer, SignupSerializer
from .tokens import email_verification_token

# ----------------------------------------------------------------------------
# This file is the whole auth flow: signup, verify email, login, logout,
# forgot password, reset password, and "view/edit my own account."
#
# A quick primer on the "uid + token in a link" pattern used a few times
# below (it's the same trick Django itself uses for password resets):
#   1. We take the account's database ID (a plain number, e.g. 7) and
#      base64-encode it so it's URL-safe-ish → that's the "uid".
#   2. We generate a signed "token" that proves WE created this link (it's
#      not something a random person could guess or forge).
#   3. We email a link like /verify-email/<uid>/<token>/.
#   4. When they click it, we decode the uid back to 7, look up that
#      account, and check the token matches — if both check out, we know
#      it's really them and the link hasn't been tampered with.
# ----------------------------------------------------------------------------


class AuthRateThrottle(AnonRateThrottle):
    # A shared rate limit for the "public" auth endpoints below (signup,
    # login, password reset). Without this, someone could hammer /login/
    # thousands of times a second trying to guess a password, or spam
    # signups to see which emails already exist. See DEFAULT_THROTTLE_RATES
    # in settings.py for the actual "10 per minute" number.
    scope = "auth"


def _send_verification_email(account, request):
    uid = urlsafe_base64_encode(force_bytes(account.pk))
    token = email_verification_token.make_token(account)
    verify_url = f"{settings.FRONTEND_URL}/verify-email/{uid}/{token}/"
    send_mail(
        subject="Verify your MellaX account",
        message=f"Confirm your email to activate your MellaX account: {verify_url}",
        from_email=None,  # None = use Django's DEFAULT_FROM_EMAIL setting
        recipient_list=[account.email],
    )
    # Note: in development, EMAIL_BACKEND is set to the "console" backend,
    # so this doesn't actually send an email — it just prints it to the
    # terminal running `manage.py runserver`. Good enough for testing the
    # flow without needing a real email provider set up yet.


class SignupView(generics.CreateAPIView):
    """POST /api/accounts/signup/ — step 1 of the Sign-Up & Onboarding Flow."""

    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]  # you're not logged in yet, obviously
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        # We override the default create() (instead of just letting
        # CreateAPIView handle everything) because we need an extra step
        # after saving: firing off the verification email.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # 400 error automatically if anything's invalid
        account = serializer.save()
        _send_verification_email(account, request)
        return Response(
            {"detail": "Account created. Check your email to verify your account."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """POST /api/accounts/verify-email/<uidb64>/<token>/ — clicking the emailed link lands here."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request, uidb64, token):
        try:
            # Decode the uid back into a plain database ID and look up the account.
            pk = force_str(urlsafe_base64_decode(uidb64))
            account = BusinessAccount.objects.get(pk=pk)
        except (BusinessAccount.DoesNotExist, ValueError, TypeError, OverflowError):
            # Covers "the link is garbage / been tampered with / account
            # doesn't exist" — we don't need to tell the difference, they
            # all just mean "this link doesn't work."
            account = None

        if account is None or not email_verification_token.check_token(account, token):
            return Response(
                {"detail": "Invalid or expired verification link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        account.is_email_verified = True
        account.save(update_fields=["is_email_verified"])
        # update_fields tells Django to only write THIS column to the
        # database, instead of re-saving every field on the model — a
        # small efficiency thing, and also avoids accidentally overwriting
        # other fields with stale in-memory values.
        return Response({"detail": "Email verified. You can now log in."})


class LoginView(APIView):
    """POST /api/accounts/login/ — trades email+password for an auth token."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.validated_data["account"]

        # get_or_create means: if this account already has a token from a
        # previous login, reuse it instead of making a new one every time.
        # The frontend stores this token and sends it back as
        # "Authorization: Token <key>" on every future request — that's
        # how the backend knows who's asking.
        token, _ = Token.objects.get_or_create(user=account)
        return Response(
            {"token": token.key, "account": BusinessAccountSerializer(account).data}
        )


class LogoutView(APIView):
    """POST /api/accounts/logout/ — kills the current auth token."""

    def post(self, request):
        # Deleting the token means it stops working immediately, everywhere
        # (not just "forget it on this device" — it's actually invalidated
        # server-side).
        request.user.auth_token.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)  # 204 = success, nothing to send back


class ForgotPasswordView(APIView):
    """POST /api/accounts/forgot-password/ — kicks off a password reset email."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email = request.data.get("email", "")
        try:
            account = BusinessAccount.objects.get(email__iexact=email)  # iexact = case-insensitive match
        except BusinessAccount.DoesNotExist:
            account = None

        # IMPORTANT: we return the exact same success message whether or
        # not that email is actually registered. If we said "email not
        # found" for unknown emails, anyone could use this form to check
        # which emails have a MellaX account — a privacy leak. So instead:
        # always say "if it exists, check your inbox," and only actually
        # send the email when it does.
        if account is not None:
            uid = urlsafe_base64_encode(force_bytes(account.pk))
            token = default_token_generator.make_token(account)  # Django's built-in password-reset token
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"
            send_mail(
                subject="Reset your MellaX password",
                message=f"Reset your password: {reset_url}",
                from_email=None,
                recipient_list=[account.email],
            )
        return Response({"detail": "If that email exists, a reset link has been sent."})


class ResetPasswordView(APIView):
    """POST /api/accounts/reset-password/<uidb64>/<token>/ — the link from the email above lands here."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request, uidb64, token):
        new_password = request.data.get("password", "")
        if len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pk = force_str(urlsafe_base64_decode(uidb64))
            account = BusinessAccount.objects.get(pk=pk)
        except (BusinessAccount.DoesNotExist, ValueError, TypeError, OverflowError):
            account = None

        if account is None or not default_token_generator.check_token(account, token):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        account.set_password(new_password)  # this hashes it — never stored as plain text
        account.save(update_fields=["password"])
        return Response({"detail": "Password updated. You can now log in."})


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/accounts/me/ — view or edit your own account (Settings > Business Information)."""

    serializer_class = BusinessAccountSerializer

    def get_object(self):
        # Normally a RetrieveUpdateAPIView looks up an object by an ID in
        # the URL (like /api/clients/5/). Here there's no ID in the URL —
        # "me" always just means "whoever's logged in," so we skip the
        # lookup entirely and return the current user directly.
        return self.request.user
