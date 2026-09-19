from rest_framework import serializers

from .models import Client

# ----------------------------------------------------------------------------
# A ModelSerializer auto-generates most of its behavior from the model —
# we're just telling it which fields to expose over the API, and which of
# those fields the frontend is allowed to set vs. only allowed to read.
# ----------------------------------------------------------------------------


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "name", "email", "phone", "notes", "created_at", "updated_at"]
        # These come back in every response, but the frontend can't set
        # them directly — "id" is assigned by the database, and the two
        # timestamps are managed automatically by the model (auto_now_add
        # / auto_now in common/models.py).
        read_only_fields = ["id", "created_at", "updated_at"]
