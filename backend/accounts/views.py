from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMessage, send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from common.views import TenantScopedModelViewSet

from .models import BusinessAccount, SupportRequest
from .serializers import (
    BusinessAccountSerializer,
    ChangePlanSerializer,
    LoginSerializer,
    SignupSerializer,
    SubscriptionSerializer,
    SupportRequestSerializer,
)
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


def _notify_owner(subject, body, reply_to=None):
    # Sends a plain email to Mako's own inbox (OWNER_NOTIFY_EMAIL in
    # settings) for things worth knowing about right away — a cancellation,
    # a new Feedback & Support submission. Used instead of making the
    # owner check a dashboard for these. Deliberately never raises: a
    # support request or a cancellation still has to go through and get
    # saved even if this particular email fails to send.
    if not settings.OWNER_NOTIFY_EMAIL:
        return  # not configured (e.g. local dev) - nothing to send to yet
    try:
        EmailMessage(
            subject=f"[MellaX] {subject}",
            body=body,
            to=[settings.OWNER_NOTIFY_EMAIL],
            reply_to=[reply_to] if reply_to else None,
        ).send(fail_silently=True)
    except Exception:
        pass


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
            {
                "token": token.key,
                # context={"request": request} matters here — without it,
                # DRF's ImageField has no request to build an absolute URL
                # from, so `logo` would come back as a bare relative path
                # ("/media/logos/x.png") instead of a full URL. Every
                # OTHER place this serializer gets used is through a
                # generic view (MeView), which passes this context
                # automatically — this is the one place it's built by
                # hand, so it's the one place that has to be explicit.
                "account": BusinessAccountSerializer(account, context={"request": request}).data,
            }
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


class SubscriptionView(APIView):
    """GET /api/accounts/subscription/ — Settings > Account & Subscription's plan, trial, and status."""

    def get(self, request):
        return Response(SubscriptionSerializer(request.user).data)


class ChangePlanView(APIView):
    """
    POST /api/accounts/subscription/change-plan/ — switch between Basic and
    Plus. Takes effect immediately, no proration, since nothing's actually
    being charged today (see the big comment on BusinessAccount's
    subscription fields in accounts/models.py).

    Note this is only reachable while logged in, and canceling (see
    CancelSubscriptionView) logs you out and blocks login entirely — so
    there's no "change plan to undo a cancellation" path here. Once
    canceled, getting back in means emailing support, not a self-serve
    plan switch.
    """

    def post(self, request):
        serializer = ChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = request.user
        account.plan_tier = serializer.validated_data["plan_tier"]
        account.save(update_fields=["plan_tier"])
        return Response(SubscriptionSerializer(account).data)


class CancelSubscriptionView(APIView):
    """
    POST /api/accounts/subscription/cancel/ — closes the account.

    Since there's no real billing yet, there's no "paid through" date to
    honor, so this takes effect right now rather than "at the end of the
    period" — the account is logged out everywhere immediately and can't
    log back in. Nothing is deleted: all client/invoice/etc data stays
    exactly as it was, so a reply to the notification email below is
    enough to turn is_active back on by hand if they change their mind.
    """

    def post(self, request):
        account = request.user
        account.subscription_status = BusinessAccount.STATUS_CANCELED
        account.canceled_at = timezone.now()
        account.is_active = False
        account.save(update_fields=["subscription_status", "canceled_at", "is_active"])
        Token.objects.filter(user=account).delete()  # signs them out on every device right away, not just this one
        _notify_owner(
            f"{account.business_name} canceled their subscription",
            f"{account.business_name} ({account.email}) just canceled, on the {account.plan_tier} plan.\n\n"
            "Their data is still intact. Reactivate by flipping is_active back on for their account.",
        )
        return Response({"detail": "Your subscription has been canceled. We're sorry to see you go."})


class SupportRequestViewSet(TenantScopedModelViewSet):
    """
    GET  /api/accounts/support/ — your own past bug reports, feature
    requests, questions, and billing/refund requests (Settings > Feedback
    & Support).
    POST /api/accounts/support/ — send a new one. Saved here AND emailed
    straight to the owner's inbox, so a submission is never just sitting
    somewhere nobody reads it.
    """

    queryset = SupportRequest.objects.all()
    serializer_class = SupportRequestSerializer
    http_method_names = ["get", "post", "head", "options"]  # a submission is a one-way note, not something to edit or delete

    def perform_create(self, serializer):
        account = self.request.user
        support_request = serializer.save(business_account=account)
        category_label = dict(SupportRequest.CATEGORY_CHOICES).get(support_request.category, support_request.category)
        _notify_owner(
            f"{category_label} from {account.business_name}",
            f"From: {account.business_name} <{account.email}>\nPlan: {account.plan_tier}\n\n{support_request.message}",
            reply_to=account.email,
        )
