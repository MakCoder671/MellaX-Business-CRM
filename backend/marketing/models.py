from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# Marketing (Basic version), per business_plan.MD: "create e-blasts using
# a handful of built-in templates, sent manually to your client list."
#
# Notice there's no Template model here — the built-in templates are just
# static starting text defined in the FRONTEND (pick one, it fills in the
# subject/body, then you edit it like normal). No need for a whole extra
# database table just to hold a few pieces of starter copy.
#
# Also notice this is called EBlast, not "Campaign" — "Campaign" is a
# DIFFERENT, more complex feature (lead capture links + QR codes) that's
# explicitly deferred to a later version in the plan doc's Roadmap
# section. Keeping the names distinct avoids future confusion between
# the two.
# ----------------------------------------------------------------------------


class MarketingTemplate(TenantScopedModel):
    """
    A design the owner made in Canva and uploaded here as an image. E-Blasts and
    Campaigns can use it. The Canva link is kept so the owner can open and edit
    the design again later.
    """

    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to="marketing_templates/")
    canva_link = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class EBlast(TenantScopedModel):
    subject = models.CharField(max_length=255)
    body = models.TextField()

    # Which built-in template this started from, just for reference (e.g.
    # showing "Started from: Seasonal Promotion" in the UI later) — not
    # used for anything functional, since the actual content lives in
    # subject/body above and stays editable regardless of where it started.
    template_key = models.CharField(max_length=50, blank=True)

    # null = still a draft, hasn't been sent yet. Once sent, an e-blast is
    # locked (see marketing/serializers.py) — you can't edit or re-send
    # something that already went out to real people's inboxes.
    sent_at = models.DateTimeField(null=True, blank=True)
    # A snapshot of how many clients it went to, taken at send time. Not
    # calculated live from the client list, since that list can keep
    # changing after the fact (clients added/removed) — this should
    # always answer "how many people got THIS email," not "how many
    # clients do I have right now."
    recipient_count = models.PositiveIntegerField(default=0)

    # An optional Canva design (uploaded as a template) shown at the top of the email.
    template = models.ForeignKey(
        MarketingTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name="eblasts"
    )

    class Meta:
        ordering = ["-created_at"]  # newest first, so the list page shows recent activity up top without the frontend needing to sort it

    def __str__(self):
        return self.subject
