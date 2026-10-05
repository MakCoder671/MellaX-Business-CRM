from django.urls import path

from .views import (
    MyLandingPageView,
    MyLandingPagePhotoDetailView,
    MyLandingPagePhotoListView,
    MyLandingPagePhotoReorderView,
    PublicLandingPageView,
)

urlpatterns = [
    path("me/", MyLandingPageView.as_view(), name="my-landing-page"),
    path("me/photos/", MyLandingPagePhotoListView.as_view(), name="my-landing-page-photos"),
    path("me/photos/reorder/", MyLandingPagePhotoReorderView.as_view(), name="my-landing-page-photos-reorder"),
    path("me/photos/<int:pk>/", MyLandingPagePhotoDetailView.as_view(), name="my-landing-page-photo"),
    path("public/<slug:slug>/", PublicLandingPageView.as_view(), name="public-landing-page"),
]
