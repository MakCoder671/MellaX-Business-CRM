from django.core.mail import send_mail
from django.utils import timezone
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


class EBlastViewSet(TenantScopedModelViewSet):
    queryset = EBlast.objects.all()
    serializer_class = EBlastSerializer

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """
        POST /api/marketing/eblasts/<id>/send/ — the "sent manually to
        your client list" part of the plan doc. Sends the same subject/
        body to every client that has an email on file, then locks the
        e-blast so it can't be edited or sent again.
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
            send_mail(
                subject=eblast.subject,
                message=eblast.body,
                from_email=None,  # None = use Django's DEFAULT_FROM_EMAIL setting
                recipient_list=[email],
            )

        eblast.sent_at = timezone.now()
        eblast.recipient_count = len(recipients)
        eblast.save(update_fields=["sent_at", "recipient_count"])

        return Response(EBlastSerializer(eblast).data)
