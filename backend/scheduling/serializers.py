from datetime import timedelta

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
        fields = ["id", "calendar", "client", "datetime", "duration_minutes", "status", "source", "created_at"]
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

        # Double-booking check (Settings > Calendar > Allow double
        # booking). Off by default: a new or edited appointment can't
        # overlap another one already on the SAME calendar. A cancelled
        # appointment doesn't block anything — cancelling frees the slot.
        if not account.allow_double_booking and calendar:
            start = attrs.get("datetime") or getattr(self.instance, "datetime", None)
            duration = attrs.get("duration_minutes")
            if duration is None:
                duration = getattr(self.instance, "duration_minutes", 60)
            status = attrs.get("status") or getattr(self.instance, "status", Appointment.STATUS_SCHEDULED)

            if start and status != Appointment.STATUS_CANCELLED:
                end = start + timedelta(minutes=duration)
                others = Appointment.objects.for_account(account).filter(calendar=calendar).exclude(
                    status=Appointment.STATUS_CANCELLED
                )
                if self.instance is not None:
                    others = others.exclude(pk=self.instance.pk)  # don't compare an appointment against itself when editing

                # Two time ranges [a_start, a_end) and [b_start, b_end)
                # overlap exactly when a_start < b_end AND b_start < a_end
                # — simple enough to check in Python for the handful of
                # appointments a small business's calendar actually has,
                # rather than writing a more complex overlap query.
                for other in others:
                    other_end = other.datetime + timedelta(minutes=other.duration_minutes)
                    if start < other_end and other.datetime < end:
                        raise serializers.ValidationError(
                            "This time overlaps with an existing appointment. "
                            "Turn on double booking in Settings > Calendar if you want to allow this."
                        )

        return attrs


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = ["id", "day_of_week", "open_time", "close_time", "is_open"]
        read_only_fields = ["id"]
