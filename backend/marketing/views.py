from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape, linebreaks
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from clients.models import Client
from common.views import TenantScopedModelViewSet

from .models import EBlast
from .serializers import EBlastSerializer

# ----------------------------------------------------------------------------
# One ViewSet handles both the normal draft CRUD (list/create/retrieve/
# delete — update is blocked for sent e-blasts by the serializer) AND a
# custom "send" action bolted on with @action below. DRF's routers pick
# up @action-decorated methods automatically and turn them into their
# own URL, e.g. POST /api/marketing/eblasts/7/send/.
# ----------------------------------------------------------------------------


def _build_html_email(request, account, eblast):
    """
    Wraps the business's plain-text subject/body in a simple branded
    shell — this is the "Branding connects to Marketing" piece: the
    account's own logo and business name/address show up automatically
    on every e-blast, with nothing to re-enter per campaign.
    """
    logo_html = ""
    if account.logo:
        # build_absolute_uri turns the logo's relative MEDIA_URL path
        # into a full http://... URL — an email client has no idea what
        # "relative to this site" even means, unlike a browser tab.
        logo_url = request.build_absolute_uri(account.logo.url)
        logo_html = f'<img src="{escape(logo_url)}" alt="{escape(account.business_name)}" style="height:48px;width:auto;margin-bottom:16px;">'

    # linebreaks() both HTML-escapes the business-authored text (so a
    # stray "<" or "&" someone typed can't break the email's HTML or
    # inject markup) AND turns blank lines into paragraph breaks — the
    # same thing Django's {{ value|linebreaks }} template filter does.
    body_html = linebreaks(eblast.body)

    address_line = f"<br>{escape(account.address)}" if account.address else ""

    return f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      {logo_html}
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

        html_body = _build_html_email(request, request.user, eblast)

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
            message.attach_alternative(html_body, "text/html")
            message.send()

        eblast.sent_at = timezone.now()
        eblast.recipient_count = len(recipients)
        eblast.save(update_fields=["sent_at", "recipient_count"])

        return Response(EBlastSerializer(eblast).data)
