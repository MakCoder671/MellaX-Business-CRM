from rest_framework import serializers

from .models import EBlast

# ----------------------------------------------------------------------------
# The actual "send this email to my client list" logic lives in
# marketing/views.py (on the SendEBlastView), not here — this file is
# just for turning an EBlast row into/from JSON. Keeping the sending
# side-effect out of the serializer keeps this file simple and makes the
# "where does sending actually happen" question have one obvious answer.
# ----------------------------------------------------------------------------


class EBlastSerializer(serializers.ModelSerializer):
    class Meta:
        model = EBlast
        fields = [
            "id",
            "subject",
            "body",
            "template_key",
            "sent_at",
            "recipient_count",
            "created_at",
            "updated_at",
        ]
        # recipient_count and sent_at are only ever set by the send
        # action, never directly edited by the frontend.
        read_only_fields = ["id", "sent_at", "recipient_count", "created_at", "updated_at"]

    def validate(self, attrs):
        # Once an e-blast has actually been sent, it's locked — editing
        # the subject/body afterward would be misleading (the email that
        # already landed in someone's inbox can't un-send itself to
        # match). self.instance is None on create, so this check only
        # matters for updates (PATCH) to an existing row.
        if self.instance is not None and self.instance.sent_at is not None:
            raise serializers.ValidationError("This e-blast has already been sent and can't be edited.")
        return attrs
