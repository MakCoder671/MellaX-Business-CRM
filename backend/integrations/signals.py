from django.db import transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from clients.models import Client
from invoicing.models import Invoice, PaymentRecord
from scheduling.models import Appointment

from . import events, sync
from .models import AppointmentSyncLink


# Every save of an appointment is sent to its connected calendars, but only once
# the save has committed. That way a calendar hiccup can't roll back a booking.
@receiver(post_save, sender=Appointment)
def appointment_saved(sender, instance, **kwargs):
    appointment_id = instance.pk
    transaction.on_commit(lambda: sync.sync_appointment_now(appointment_id))


# A deleted appointment's events need removing from the calendars too. The links
# are deleted along with the appointment, so we note them now, before that happens.
@receiver(pre_delete, sender=Appointment)
def appointment_deleting(sender, instance, **kwargs):
    refs = list(AppointmentSyncLink.objects.filter(appointment=instance).values_list("connection_id", "external_ref"))
    if refs:
        transaction.on_commit(lambda: sync.remove_links_now(refs))


# Let Slack, Zapier, and Mailchimp know about new bookings, paid invoices, and new clients.
@receiver(post_save, sender=Appointment)
def appointment_booked(sender, instance, created, **kwargs):
    if not created:
        return
    data = {
        "client": instance.client.full_name,
        "service": instance.service.name if instance.service_id else "",
        "when": instance.datetime.isoformat(),
        "duration_minutes": instance.duration_minutes,
        "source": instance.source,
    }
    events.notify(instance.business_account_id, "appointment.booked", data)


@receiver(post_save, sender=Client)
def client_created(sender, instance, created, **kwargs):
    if not created:
        return
    data = {"name": instance.full_name, "first_name": instance.first_name, "last_name": instance.last_name, "email": instance.email, "phone": instance.phone}
    events.notify(instance.business_account_id, "client.created", data)


@receiver(post_save, sender=PaymentRecord)
def payment_recorded(sender, instance, created, **kwargs):
    # Checked after the commit, because the invoice only becomes "paid" once the payment is saved.
    if not created or instance.is_refund:
        return
    payment_id = instance.pk
    transaction.on_commit(lambda: _notify_if_paid(payment_id))


def _notify_if_paid(payment_id):
    payment = PaymentRecord.objects.select_related("invoice", "client").filter(pk=payment_id).first()
    if payment is None or payment.invoice.status != Invoice.STATUS_PAID:
        return
    data = {
        "invoice_number": payment.invoice.invoice_number,
        "client": payment.client.full_name,
        "total": f"{payment.invoice.total_due():.2f}",
    }
    events.deliver(payment.business_account_id, "invoice.paid", data)
