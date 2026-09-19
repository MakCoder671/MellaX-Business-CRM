from django.urls import path

from .views import MyLandingPageView, PublicLandingPageView

urlpatterns = [
    path("me/", MyLandingPageView.as_view(), name="my-landing-page"),
    path("public/<slug:slug>/", PublicLandingPageView.as_view(), name="public-landing-page"),
]
