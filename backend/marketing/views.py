from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape, linebreaks
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from clients.models import Client
from common.email_images import attach_inline_image
from common.views import TenantScopedModelViewSet

from .models import EBlast, MarketingTemplate
from .serializers import EBlastSerializer, MarketingTemplateSerializer

# ----------------------------------------------------------------------------
# One ViewSet handles both the normal draft CRUD (list/create/retrieve/
# delete — update is blocked for sent e-blasts by the serializer) AND a
# custom "send" action bolted on with @action below. DRF's routers pick
# up @action-decorated methods automatically and turn them into their
# own URL, e.g. POST /api/marketing/eblasts/7/send/.
# ----------------------------------------------------------------------------


def _build_html_email(account, eblast, logo_src=None, design_src=None):
    """
    Wraps the business's plain-text subject/body in a simple branded
    shell — this is the "Branding connects to Marketing" piece: the
    account's own logo and business name/address show up automatically
    on every e-blast, with nothing to re-enter per campaign.

    logo_src and design_src are the addresses the images are attached under (see
    common/email_images.py), so the email never depends on a public web address.
    """
    logo_html = ""
    if logo_src:
        logo_html = f'<img src="{escape(logo_src)}" alt="{escape(account.business_name)}" style="height:48px;width:auto;margin-bottom:16px;">'

    # linebreaks() both HTML-escapes the business-authored text (so a
    # stray "<" or "&" someone typed can't break the email's HTML or
    # inject markup) AND turns blank lines into paragraph breaks — the
    # same thing Django's {{ value|linebreaks }} template filter does.
    body_html = linebreaks(eblast.body)

    # The Canva design, shown full width above the text if the owner picked one.
    template_html = ""
    if design_src and eblast.template_id:
        template_html = (
            f'<img src="{escape(design_src)}" alt="{escape(eblast.template.name)}" '
            f'style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;margin-bottom:20px;">'
        )

    address_line = "".join(f"<br>{escape(line)}" for line in account.formatted_address_lines())

    return f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      {logo_html}
      {template_html}
      {body_html}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
        {escape(account.business_name)}{address_line}
      </p>
    </div>
    """


class EBlastViewSet(TenantScopedModelViewSet):
    queryset = EBlast.objects.all()
    serializer_class = EBlastSerializer

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """
        POST /api/marketing/eblasts/<id>/send/ — the "sent manually to
        your client list" part of the plan doc. Sends the same subject/
        body (wrapped with the business's logo and contact info, see
        _build_html_email above) to every client that has an email on
        file, then locks the e-blast so it can't be edited or sent again.
        """
        eblast = self.get_object()  # already scoped to this account via get_queryset() — can't send someone else's e-blast

        if eblast.sent_at is not None:
            return Response(
                {"detail": "This e-blast has already been sent."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipients = list(
            Client.objects.for_account(request.user)
            .exclude(email="")
            .values_list("email", flat=True)
        )
        if not recipients:
            return Response(
                {"detail": "None of your clients have an email on file yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )


        # send_mail with a list of names in recipient_list would put every
        # client's address in the same "To:" field, so everyone could see
        # everyone else's email — not great. Sending one at a time (each
        # in their own recipient_list) keeps every client's address
        # private from the others, at the cost of one email per client
        # instead of one email total. Fine at small-business scale.
        for email in recipients:
            # EmailMultiAlternatives instead of plain send_mail: the
            # "message" argument is a plain-text fallback for email
            # clients that don't render HTML, and attach_alternative adds
            # the actual branded HTML version most clients will show.
            message = EmailMultiAlternatives(
                subject=eblast.subject,
                body=eblast.body,
                from_email=None,  # None = use Django's DEFAULT_FROM_EMAIL setting
                to=[email],
            )
            # The logo and the design go in as attachments, so the email shows them without a public web address.
            logo_src = attach_inline_image(message, request.user.logo, "mellax-logo") if request.user.logo else None
            design = eblast.template.image if eblast.template_id and eblast.template.image else None
            design_src = attach_inline_image(message, design, "mellax-design") if design else None
            message.attach_alternative(_build_html_email(request.user, eblast, logo_src, design_src), "text/html")
            message.send()

        eblast.sent_at = timezone.now()
        eblast.recipient_count = len(recipients)
        eblast.save(update_fields=["sent_at", "recipient_count"])

        return Response(EBlastSerializer(eblast).data)


class MarketingTemplateViewSet(TenantScopedModelViewSet):
    """/api/marketing/templates/ — the Canva designs the owner uploaded."""

    queryset = MarketingTemplate.objects.all()
    serializer_class = MarketingTemplateSerializer
