from django.db import migrations

# ----------------------------------------------------------------------------
# Most migrations just change the database SCHEMA (add a column, create a
# table). This one is a "data migration" instead — it inserts actual ROWS.
# It runs the first time you `python manage.py migrate` after this file
# exists, and puts these six default tender types into the database so
# every account has "Cash", "Visa", etc available immediately, without
# anyone having to type them in by hand.
#
# `apps.get_model(...)` instead of importing TenderType directly is a
# Django migrations thing: it gives you the model as it looked AT THIS
# POINT in migration history, not the current version in models.py (which
# might have new fields added since). Keeps old migrations from breaking
# if the model changes later.
# ----------------------------------------------------------------------------

DEFAULT_TENDER_TYPES = ["Cash", "Visa", "Mastercard", "Amex", "Discover", "Check"]


def seed_defaults(apps, schema_editor):
    TenderType = apps.get_model("invoicing", "TenderType")
    for name in DEFAULT_TENDER_TYPES:
        # business_account=None marks these as system-wide defaults (see
        # the TenderType model in models.py). get_or_create means running
        # this migration twice won't create duplicates.
        TenderType.objects.get_or_create(business_account=None, name=name, defaults={"is_custom": False})


def remove_defaults(apps, schema_editor):
    # This is the "undo" for the migration above — runs if you ever
    # reverse/rollback this migration. Deletes exactly the rows we added,
    # nothing else.
    TenderType = apps.get_model("invoicing", "TenderType")
    TenderType.objects.filter(business_account__isnull=True, name__in=DEFAULT_TENDER_TYPES).delete()


class Migration(migrations.Migration):
    dependencies = [("invoicing", "0001_initial")]  # needs the TenderType table to exist first
    operations = [migrations.RunPython(seed_defaults, remove_defaults)]
