from django.core.management.base import BaseCommand
from django.utils import timezone

from invoicing.models import VOID_AGE, Invoice

# ----------------------------------------------------------------------------
# The real "end of day processing" Mako asked for — every invoice on
# every account that's more than 24 hours old and was NEVER paid gets
# its status flipped to Void, permanently. A Paid or Refunded invoice
# locks from further edits just as hard once it ages (Invoice.is_locked()
# doesn't care about status at all), but keeps its real status forever —
# see Invoice.sync_void_status() for the full reasoning on why Void only
# ever means "aged out, never paid" now, not just "old."
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
    help = "Voids every invoice (across every account) that's more than 24 hours old and was never paid."

    def handle(self, *args, **options):
        cutoff = timezone.now() - VOID_AGE
        updated = (
            Invoice.objects.filter(status=Invoice.STATUS_UNPAID, created_at__lte=cutoff)
            .update(status=Invoice.STATUS_VOID)
        )
        self.stdout.write(self.style.SUCCESS(f"Voided {updated} invoice(s)."))
