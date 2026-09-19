from django.db import migrations

DEFAULT_TENDER_TYPES = ["Cash", "Visa", "Mastercard", "Amex", "Discover", "Check"]


def seed_defaults(apps, schema_editor):
    TenderType = apps.get_model("invoicing", "TenderType")
    for name in DEFAULT_TENDER_TYPES:
        TenderType.objects.get_or_create(business_account=None, name=name, defaults={"is_custom": False})


def remove_defaults(apps, schema_editor):
    TenderType = apps.get_model("invoicing", "TenderType")
    TenderType.objects.filter(business_account__isnull=True, name__in=DEFAULT_TENDER_TYPES).delete()


class Migration(migrations.Migration):
    dependencies = [("invoicing", "0001_initial")]
    operations = [migrations.RunPython(seed_defaults, remove_defaults)]
