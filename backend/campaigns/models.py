from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models
from django.utils.text import slugify

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# Campaign & Lead Tracking (Plus) — business_plan.MD, Plus Plan section.
# A lightweight lead-capture layer: a business creates a Campaign, gets a
# shareable link and a QR code that both point at a public form, and
# every form submission becomes a Lead.
#
# The link and the QR code point at the SAME public page, just with a
# different query string (?src=qr on the QR version) — that one
# difference is how we tell "someone typed/clicked the link" apart from
# "someone scanned the QR code" for reporting, without needing two
# separate URLs.
# ----------------------------------------------------------------------------


class Campaign(TenantScopedModel):
    name = models.CharField(max_length=255)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # what the business spent running this campaign (an ad, a printed flyer, etc)
    details = models.TextField(blank=True)

    share_link_slug = models.SlugField(unique=True)  # e.g. "spring-sale-2026" — the public URL is /c/<this>/
    click_count = models.PositiveIntegerField(default=0)  # visits to the plain shareable link
    qr_scan_count = models.PositiveIntegerField(default=0)  # visits that came in through the QR code specifically
    qr_code_image = models.ImageField(upload_to="campaign_qr_codes/", blank=True)  # generated automatically the first time this campaign is saved, see save() below

    class Meta:
        ordering = ["-created_at"]  # newest campaign first, matching every other list in the app (invoices, e-blasts, etc)

    def __str__(self):
        return self.name

    def conversion_rate(self):
        # What fraction of everyone who clicked/scanned actually filled
        # out the lead form — the number that answers "was this worth
        # running?" alongside the raw cost.
        total_visits = self.click_count + self.qr_scan_count
        if total_visits == 0:
            return 0
        return round((self.leads.count() / total_visits) * 100, 1)

    def _generate_unique_slug(self):
        base_slug = slugify(self.name) or "campaign"
        slug = base_slug
        suffix = 1
        # If "spring-sale" is already taken by another campaign, try
        # "spring-sale-2", "spring-sale-3", etc until we find one that's free.
        while Campaign.objects.filter(share_link_slug=slug).exclude(pk=self.pk).exists():
            suffix += 1
            slug = f"{base_slug}-{suffix}"
        return slug

    def _generate_qr_code(self, url):
        # Builds a PNG QR code encoding the given URL entirely in memory
        # (BytesIO — no temp files on disk needed), then wraps it as a
        # Django ContentFile so it can be assigned straight to the
        # ImageField below, the same as if a user had uploaded it.
        img = qrcode.make(url)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return ContentFile(buffer.getvalue(), name=f"{self.share_link_slug}.png")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not self.share_link_slug:
            self.share_link_slug = self._generate_unique_slug()

        # Save once first so we have a real primary key and a finalized
        # slug in the database before generating anything that depends on
        # them (the QR code encodes a URL built from the slug).
        super().save(*args, **kwargs)

        if is_new and not self.qr_code_image:
            qr_url = f"{settings.FRONTEND_URL}/c/{self.share_link_slug}/?src=qr"
            self.qr_code_image = self._generate_qr_code(qr_url)
            super().save(update_fields=["qr_code_image"])


class Lead(TenantScopedModel):
    STATUS_NEW = "new"
    STATUS_CONTACTED = "contacted"
    STATUS_CONVERTED = "converted"
    STATUS_CHOICES = [
        (STATUS_NEW, "New"),
        (STATUS_CONTACTED, "Contacted"),
        (STATUS_CONVERTED, "Converted"),
    ]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="leads")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    interested_in = models.CharField(max_length=255, blank=True)  # free-text "what service/product are you interested in"
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_NEW)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
