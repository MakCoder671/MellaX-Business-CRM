from rest_framework import serializers

from clients.models import Client

from .models import Appointment, BusinessHours, Calendar


class CalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calendar
        fields = ["id", "name", "type", "display_order"]
        read_only_fields = ["id"]


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ["id", "calendar", "client", "datetime", "status", "source", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        # Same "don't trust IDs from the frontend blindly" pattern as the
        # invoicing serializers — make sure the calendar and client being
        # referenced actually belong to the logged-in account.
        account = self.context["request"].user

        # `getattr(self.instance, ...)` handles the update case: if this
        # is editing an existing appointment and the request didn't
        # include a new calendar/client, fall back to what it already had.
        calendar = attrs.get("calendar") or getattr(self.instance, "calendar", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)

        if calendar and not Calendar.objects.for_account(account).filter(pk=calendar.pk).exists():
            raise serializers.ValidationError({"calendar": "Calendar not found."})
        if client and not Client.objects.for_account(account).filter(pk=client.pk).exists():
            raise serializers.ValidationError({"client": "Client not found."})
        return attrs


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = ["id", "day_of_week", "open_time", "close_time", "is_open"]
        read_only_fields = ["id"]
