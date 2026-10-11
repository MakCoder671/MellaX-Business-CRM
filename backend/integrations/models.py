from django.db import models

from common.models import TenantScopedModel
from scheduling.models import Appointment


class IntegrationConnection(TenantScopedModel):
    """One connected integration for one business, like "Apple Calendar" for Jane's Salon."""

    STATUS_CONNECTED = "connected"
    STATUS_ERROR = "error"  # it's set up, but the last change didn't go through (see last_error)
    STATUS_CHOICES = [
        (STATUS_CONNECTED, "Connected"),
        (STATUS_ERROR, "Needs attention"),
    ]

    integration = models.CharField(max_length=40)  # the catalog key, e.g. "apple_calendar"
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_CONNECTED)
    secrets = models.TextField(blank=True)  # the owner's keys, encrypted (see crypto.py). Never sent back to the browser.
    options = models.JSONField(default=dict, blank=True)  # choices that aren't secret, like which calendar to use
    last_error = models.CharField(max_length=255, blank=True)  # a plain-language note for the owner, empty when all is well
    connected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business_account", "integration"], name="one_connection_per_integration"),
        ]


class AppointmentSyncLink(models.Model):
    """Remembers where an appointment lives in another app, so changes update the right event."""

    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="sync_links")
    connection = models.ForeignKey(IntegrationConnection, on_delete=models.CASCADE, related_name="sync_links")
    external_ref = models.CharField(max_length=500)  # for Apple, the event's address on the calendar server

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["appointment", "connection"], name="one_link_per_appointment_per_connection"),
        ]


class IntegrationEntitlement(TenantScopedModel):
    """An advanced integration the business has bought with a one-time fee."""

    integration = models.CharField(max_length=40)
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business_account", "integration"], name="one_purchase_per_integration"),
        ]
