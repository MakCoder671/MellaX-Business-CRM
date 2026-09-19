from django.urls import path

from . import views

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
]
