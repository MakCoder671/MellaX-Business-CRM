from datetime import timedelta

from rest_framework import serializers

from clients.models import Client
from services.models import Service

from .models import Appointment, AppointmentHistory, BusinessHours, Calendar


class CalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calendar
        fields = ["id", "name", "type", "display_order"]
        read_only_fields = ["id"]


class AppointmentHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentHistory
        fields = ["id", "change_description", "changed_at"]
        read_only_fields = fields


class AppointmentSerializer(serializers.ModelSerializer):
    # Nested read-only — every time an appointment is fetched, its full
    # change log comes along for free, which is all the "view appt
    # history" button on the client profile needs (no separate endpoint).
    history = AppointmentHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "calendar",
            "client",
            "service",
            "datetime",
            "duration_minutes",
            "status",
            "source",
            "notes",
            "recurrence_id",
            "created_at",
            "history",
        ]
        read_only_fields = ["id", "recurrence_id", "created_at"]

    def validate(self, attrs):
        # Once an appointment has been invoiced, it's locked — no edits,
        # no cancelling, no rescheduling — until that invoice is deleted.
        # Otherwise the calendar could drift out of sync with a bill
        # that's already gone out. Checked before anything else, so it
        # blocks the update outright rather than partially validating it.
        if self.instance is not None and self.instance.invoices.exists():
            raise serializers.ValidationError(
                "This appointment has already been invoiced. Delete the invoice first if you need to change it."
            )

        # Same "don't trust IDs from the frontend blindly" pattern as the
        # invoicing serializers — make sure the calendar, client, and
        # service being referenced actually belong to the logged-in account.
        account = self.context["request"].user

        # `getattr(self.instance, ...)` handles the update case: if this
        # is editing an existing appointment and the request didn't
        # include a new calendar/client/service, fall back to what it
        # already had.
        calendar = attrs.get("calendar") or getattr(self.instance, "calendar", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        service = attrs.get("service") or getattr(self.instance, "service", None)

        if calendar and not Calendar.objects.for_account(account).filter(pk=calendar.pk).exists():
            raise serializers.ValidationError({"calendar": "Calendar not found."})
        if client and not Client.objects.for_account(account).filter(pk=client.pk).exists():
            raise serializers.ValidationError({"client": "Client not found."})
        if service and not Service.objects.for_account(account).filter(pk=service.pk).exists():
            raise serializers.ValidationError({"service": "Service not found."})

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

    def update(self, instance, validated_data):
        # Log anything that actually changes about an already-existing
        # appointment — this is what the client profile's "view appt
        # history" button reads. Built from the OLD instance vs. the
        # incoming data, before super().update() overwrites it.
        changes = []
        new_datetime = validated_data.get("datetime")
        if new_datetime and new_datetime != instance.datetime:
            changes.append(
                f"Rescheduled from {instance.datetime:%b %-d, %Y %-I:%M %p} "
                f"to {new_datetime:%b %-d, %Y %-I:%M %p}"
            )
        new_status = validated_data.get("status")
        if new_status and new_status != instance.status:
            changes.append(f"Status changed to {dict(Appointment.STATUS_CHOICES).get(new_status, new_status)}")

        updated = super().update(instance, validated_data)

        for change in changes:
            AppointmentHistory.objects.create(appointment=updated, change_description=change)

        return updated


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = ["id", "day_of_week", "open_time", "close_time", "is_open"]
        read_only_fields = ["id"]
