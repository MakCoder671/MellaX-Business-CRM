from rest_framework import serializers

from .models import Client

# ----------------------------------------------------------------------------
# A ModelSerializer auto-generates most of its behavior from the model —
# we're just telling it which fields to expose over the API, and which of
# those fields the frontend is allowed to set vs. only allowed to read.
# ----------------------------------------------------------------------------


class ClientSerializer(serializers.ModelSerializer):
    # The model's fields are blank=True at the DB level (see the comment
    # in clients/models.py explaining why), which would make DRF treat
    # them as optional by default — redeclaring them here as required
    # is what actually enforces "every client needs a first and last
    # name" for anything created or edited through the API.
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    # A convenience read-only field so every page that just wants to
    # DISPLAY a client's name doesn't have to remember to glue
    # first_name + last_name together itself — one obvious place that
    # does it (see Client.full_name in clients/models.py).
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Client
        fields = ["id", "first_name", "last_name", "full_name", "email", "phone", "notes", "created_at", "updated_at"]
        # These come back in every response, but the frontend can't set
        # them directly — "id" is assigned by the database, and the two
        # timestamps are managed automatically by the model (auto_now_add
        # / auto_now in common/models.py).
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        # "The only thing required to create a client is First Name, Last
        # Name, and either a Phone Number or Email" — first/last name are
        # already required above; this is the "at least one contact
        # method" half of that rule. Falls back to the existing instance's
        # values on a partial update, so a PATCH that only touches, say,
        # `notes` doesn't spuriously fail this check.
        email = attrs.get("email", getattr(self.instance, "email", ""))
        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        if not email and not phone:
            raise serializers.ValidationError("Enter at least an email or a phone number.")
        return attrs
