from rest_framework import serializers

from .models import Service


class ServiceSerializer(serializers.ModelSerializer):
    # Computed, not stored — sent back so the frontend never has to
    # reimplement the "is this actually low" comparison itself.
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "price",
            "description",
            "is_taxable",
            "is_product",
            "stock_quantity",
            "low_stock_threshold",
            "low_stock_dismissed",
            "low_stock_snoozed_until",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "low_stock_dismissed", "low_stock_snoozed_until", "is_low_stock", "created_at", "updated_at"]

    def get_is_low_stock(self, obj):
        return obj.is_low_stock()
