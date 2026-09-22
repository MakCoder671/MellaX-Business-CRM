from django.core.management.base import BaseCommand
from django.utils import timezone

from invoicing.models import VOID_AGE, Invoice

# ----------------------------------------------------------------------------
# The real "end of day processing" Mako asked for — every invoice on
# every account that's more than 24 hours old and isn't already Void or
# a Quote gets its status flipped to Void, permanently locking it.
#
# This ALSO happens automatically, one account at a time, whenever that
# account's invoices get fetched (see InvoiceViewSet.get_queryset()) —
# so the status is already correct to look at even without this command
# ever running. This is the bulk, whole-database version of the exact
# same thing, meant to be wired up to an actual daily scheduler (cron,
# Heroku Scheduler, etc.) once one exists for this project — until then,
# it can just be run by hand:
#
#   python manage.py void_expired_invoices
# ----------------------------------------------------------------------------


class Command(BaseCommand):
    help = "Voids every invoice (across every account) that's more than 24 hours old and not already void or a quote."

    def handle(self, *args, **options):
        cutoff = timezone.now() - VOID_AGE
        updated = (
            Invoice.objects.exclude(status__in=[Invoice.STATUS_VOID, Invoice.STATUS_QUOTE])
            .filter(created_at__lte=cutoff)
            .update(status=Invoice.STATUS_VOID)
        )
        self.stdout.write(self.style.SUCCESS(f"Voided {updated} invoice(s)."))
