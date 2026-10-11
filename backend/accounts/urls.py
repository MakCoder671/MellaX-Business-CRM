from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("support", views.SupportRequestViewSet, basename="support-request")

# ----------------------------------------------------------------------------
# This maps URL paths to the view classes in views.py. It gets "mounted"
# under /api/accounts/ in mellax/urls.py, so e.g. the "signup" path below
# actually becomes /api/accounts/signup/ from the outside.
#
# <str:uidb64>/<str:token> in a path means "grab whatever text is here and
# pass it into the view function as a `uidb64` / `token` argument" — that's
# how the emailed verify/reset links end up calling VerifyEmailView.post(
# self, request, uidb64, token).
# ----------------------------------------------------------------------------

urlpatterns = [
    path("signup/", views.SignupView.as_view(), name="signup"),
    path(
        "verify-email/<str:uidb64>/<str:token>/",
        views.VerifyEmailView.as_view(),
        name="verify-email",
    ),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("forgot-password/", views.ForgotPasswordView.as_view(), name="forgot-password"),
    path(
        "reset-password/<str:uidb64>/<str:token>/",
        views.ResetPasswordView.as_view(),
        name="reset-password",
    ),
    path("me/", views.MeView.as_view(), name="me"),
    path("subscription/", views.SubscriptionView.as_view(), name="subscription"),
    path("subscription/change-plan/", views.ChangePlanView.as_view(), name="change-plan"),
    path("subscription/cancel/", views.CancelSubscriptionView.as_view(), name="cancel-subscription"),
] + router.urls
