from django.db import migrations

# ----------------------------------------------------------------------------
# Adds the newer ways people pay to every account, the same way 0002 added Cash
# and Visa. These are recorded on an invoice like any other payment. Apple Pay
# usually runs through a card processor (Stripe, Clover, or Square), but a
# business can also record it by hand.
# ----------------------------------------------------------------------------

NEW_PAYMENT_METHODS = ["Apple Pay", "Venmo", "Zelle", "Cash App"]


def seed_payment_methods(apps, schema_editor):
    TenderType = apps.get_model("invoicing", "TenderType")
    for name in NEW_PAYMENT_METHODS:
        TenderType.objects.get_or_create(business_account=None, name=name, defaults={"is_custom": False})


def remove_payment_methods(apps, schema_editor):
    TenderType = apps.get_model("invoicing", "TenderType")
    TenderType.objects.filter(business_account__isnull=True, name__in=NEW_PAYMENT_METHODS).delete()


class Migration(migrations.Migration):
    dependencies = [("invoicing", "0007_invoicelineitem_unit_cost")]

    operations = [migrations.RunPython(seed_payment_methods, remove_payment_methods)]
