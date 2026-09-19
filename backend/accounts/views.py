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


class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"

from .models import BusinessAccount
from .serializers import BusinessAccountSerializer, LoginSerializer, SignupSerializer
from .tokens import email_verification_token


def _send_verification_email(account, request):
    uid = urlsafe_base64_encode(force_bytes(account.pk))
    token = email_verification_token.make_token(account)
    verify_url = f"{settings.FRONTEND_URL}/verify-email/{uid}/{token}/"
    send_mail(
        subject="Verify your MellaX account",
        message=f"Confirm your email to activate your MellaX account: {verify_url}",
        from_email=None,
        recipient_list=[account.email],
    )


class SignupView(generics.CreateAPIView):
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        _send_verification_email(account, request)
        return Response(
            {"detail": "Account created. Check your email to verify your account."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request, uidb64, token):
        try:
            pk = force_str(urlsafe_base64_decode(uidb64))
            account = BusinessAccount.objects.get(pk=pk)
        except (BusinessAccount.DoesNotExist, ValueError, TypeError, OverflowError):
            account = None

        if account is None or not email_verification_token.check_token(account, token):
            return Response(
                {"detail": "Invalid or expired verification link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        account.is_email_verified = True
        account.save(update_fields=["is_email_verified"])
        return Response({"detail": "Email verified. You can now log in."})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.validated_data["account"]
        token, _ = Token.objects.get_or_create(user=account)
        return Response(
            {"token": token.key, "account": BusinessAccountSerializer(account).data}
        )


class LogoutView(APIView):
    def post(self, request):
        request.user.auth_token.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email = request.data.get("email", "")
        try:
            account = BusinessAccount.objects.get(email__iexact=email)
        except BusinessAccount.DoesNotExist:
            account = None

        # Always return 200 regardless of whether the email exists, so this
        # endpoint can't be used to enumerate registered accounts.
        if account is not None:
            uid = urlsafe_base64_encode(force_bytes(account.pk))
            token = default_token_generator.make_token(account)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"
            send_mail(
                subject="Reset your MellaX password",
                message=f"Reset your password: {reset_url}",
                from_email=None,
                recipient_list=[account.email],
            )
        return Response({"detail": "If that email exists, a reset link has been sent."})


class ResetPasswordView(APIView):
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

        account.set_password(new_password)
        account.save(update_fields=["password"])
        return Response({"detail": "Password updated. You can now log in."})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = BusinessAccountSerializer

    def get_object(self):
        return self.request.user
