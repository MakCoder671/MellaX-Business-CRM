from django.db import models

# ----------------------------------------------------------------------------
# Every account gets one auto-generated public landing page — this is the
# thing anyone on the internet can view (no login needed) to see a
# business's info, services, and contact details. See landingpages/views.py
# for how we keep this carefully separated from the private dashboard API.
# ----------------------------------------------------------------------------


class LandingPage(models.Model):
    business_account = models.OneToOneField(  # OneToOne, not ForeignKey — exactly one landing page per account, not many
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="landing_page",
    )
    slug = models.SlugField(unique=True)  # the URL-friendly identifier, e.g. mellax.com/l/janes-lawn-care
    blurb_text = models.TextField(blank=True)
    booking_enabled = models.BooleanField(default=False)  # Plus feature — lets clients book appointments right from this page
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug


class LandingPagePhoto(models.Model):
    # A landing page can have a gallery of multiple photos — this is the
    # "many" side of a one-landing-page-to-many-photos relationship.
    landing_page = models.ForeignKey(LandingPage, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="landing_pages/")  # actual image files get saved under media/landing_pages/
    display_order = models.PositiveIntegerField(default=0)  # controls the order photos appear in the gallery
