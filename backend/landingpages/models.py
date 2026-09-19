from django.db import models


class LandingPage(models.Model):
    business_account = models.OneToOneField(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="landing_page",
    )
    slug = models.SlugField(unique=True)
    blurb_text = models.TextField(blank=True)
    booking_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug


class LandingPagePhoto(models.Model):
    landing_page = models.ForeignKey(LandingPage, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="landing_pages/")
    display_order = models.PositiveIntegerField(default=0)
