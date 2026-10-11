from django.urls import path

from .views import (
    MyLandingPageView,
    MyLandingPagePhotoDetailView,
    MyLandingPagePhotoListView,
    MyLandingPagePhotoReorderView,
    MyLandingPageReviewApproveView,
    MyLandingPageReviewDetailView,
    MyLandingPageReviewListView,
    PublicLandingPageReviewView,
    PublicLandingPageAvailabilityView,
    PublicLandingPageBookView,
    PublicLandingPageView,
)

urlpatterns = [
    path("me/", MyLandingPageView.as_view(), name="my-landing-page"),
    path("me/photos/", MyLandingPagePhotoListView.as_view(), name="my-landing-page-photos"),
    path("me/photos/reorder/", MyLandingPagePhotoReorderView.as_view(), name="my-landing-page-photos-reorder"),
    path("me/photos/<int:pk>/", MyLandingPagePhotoDetailView.as_view(), name="my-landing-page-photo"),
    path("public/<slug:slug>/", PublicLandingPageView.as_view(), name="public-landing-page"),
    path("public/<slug:slug>/availability/", PublicLandingPageAvailabilityView.as_view(), name="public-landing-page-availability"),
    path("public/<slug:slug>/book/", PublicLandingPageBookView.as_view(), name="public-landing-page-book"),
    path("me/reviews/", MyLandingPageReviewListView.as_view(), name="my-landing-page-reviews"),
    path("me/reviews/<int:pk>/approve/", MyLandingPageReviewApproveView.as_view(), name="my-landing-page-review-approve"),
    path("me/reviews/<int:pk>/", MyLandingPageReviewDetailView.as_view(), name="my-landing-page-review"),
    path("public/<slug:slug>/reviews/", PublicLandingPageReviewView.as_view(), name="public-landing-page-reviews"),
]
