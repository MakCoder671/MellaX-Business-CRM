from django.db import models

# Same accent presets as the frontend's ACCENT_PRESETS (lib/themePresets.ts), so
# the landing page picks from the same palette. Keep these two lists in step.
LANDING_ACCENT_CHOICES = [
    ("emerald", "Emerald"),
    ("teal", "Teal"),
    ("ocean", "Ocean"),
    ("lagoon", "Lagoon"),
    ("indigo", "Indigo"),
    ("grape", "Grape"),
    ("twilight", "Twilight"),
    ("berry", "Berry"),
    ("rose", "Rose"),
    ("crimson", "Crimson"),
    ("sunset", "Sunset"),
    ("amber", "Amber"),
    ("slate", "Slate"),
    ("midnight", "Midnight"),
]

# The page background. "charcoal" is the one dark option, and the frontend
# switches text and card colors to match it.
LANDING_BACKGROUND_CHOICES = [
    ("white", "White"),
    ("cream", "Warm cream"),
    ("mist", "Soft gray"),
    ("tint", "Accent tint"),
    ("charcoal", "Charcoal"),
]

# How the cards (services, reviews, hours, and so on) are drawn.
LANDING_CARD_CHOICES = [
    ("outline", "Outlined"),
    ("shadow", "Soft shadow"),
    ("flat", "Flat"),
]

# The social networks the owner can add. "website" is for any other link.
SOCIAL_PLATFORM_CHOICES = [
    ("facebook", "Facebook"),
    ("instagram", "Instagram"),
    ("x", "X"),
    ("tiktok", "TikTok"),
    ("youtube", "YouTube"),
    ("yelp", "Yelp"),
    ("pinterest", "Pinterest"),
    ("threads", "Threads"),
    ("snapchat", "Snapchat"),
    ("whatsapp", "WhatsApp"),
    ("google", "Google Business"),
    ("website", "Website"),
]

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
    # The landing page's own look, separate from the dashboard theme.
    landing_accent = models.CharField(max_length=20, choices=LANDING_ACCENT_CHOICES, default="emerald")
    landing_background = models.CharField(max_length=12, choices=LANDING_BACKGROUND_CHOICES, default="white")
    landing_font = models.CharField(
        max_length=12,
        choices=[("modern", "Modern & bold"), ("editorial", "Editorial"), ("clean", "Clean & minimal")],
        default="modern",
    )
    landing_corners = models.CharField(
        max_length=8,
        choices=[("soft", "Soft"), ("square", "Square"), ("round", "Extra rounded")],
        default="soft",
    )
    landing_cards = models.CharField(max_length=10, choices=LANDING_CARD_CHOICES, default="shadow")
    # What sits where the business name would be at the top of the page: the name
    # as text, or the logo from Settings > Branding (falls back to the name if there's no logo).
    hero_mark = models.CharField(max_length=8, choices=[("name", "Business name"), ("logo", "Logo")], default="name")
    # The owner's social links, as a list of {"platform": "instagram", "url": "https://..."}.
    # The serializer checks every entry, so only clean links are ever stored.
    social_links = models.JSONField(default=list, blank=True)
    booking_enabled = models.BooleanField(default=True)  # the owner's on/off switch for online booking — only actually takes effect on a Plus or Premium plan (see booking_available)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug

    @property
    def booking_available(self):
        # Online booking is a Plus feature. Checked here on the server, never
        # just hidden in the UI, so a Basic account can't reach it by calling
        # the API directly either.
        return self.business_account.plan_tier in ("plus", "premium") and self.booking_enabled


class LandingPagePhoto(models.Model):
    # A landing page can have a gallery of multiple photos — this is the
    # "many" side of a one-landing-page-to-many-photos relationship.
    landing_page = models.ForeignKey(LandingPage, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="landing_pages/")  # actual image files get saved under media/landing_pages/
    display_order = models.PositiveIntegerField(default=0)  # controls the order photos appear in the gallery

    class Meta:
        ordering = ["display_order", "id"]  # without this, the gallery order isn't guaranteed at all


# Gallery cap. The owner's page is a one-page landing, not a portfolio archive,
# so the number is capped here on the server, not just hidden in the UI.
MAX_GALLERY_PHOTOS = 12


class LandingPageReview(models.Model):
    """
    A review a visitor leaves on the landing page. Reviews start unapproved and
    stay hidden from the public page until the owner approves them, which keeps
    spam and fake reviews off the page.
    """

    landing_page = models.ForeignKey(LandingPage, on_delete=models.CASCADE, related_name="reviews")
    author_name = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField()  # 1 to 5 stars, checked in the serializer
    text = models.TextField(max_length=1000, blank=True)
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
