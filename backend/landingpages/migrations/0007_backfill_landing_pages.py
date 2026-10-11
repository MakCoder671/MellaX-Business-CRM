from django.db import migrations

from landingpages.slugs import base_address_for_business


# ----------------------------------------------------------------------------
# Gives a landing page to every account that doesn't have one yet. Accounts made
# before the page feature existed would otherwise have no public address at all.
# This uses the historical model (the table as it was at this step), so it keeps
# working even after the models change later.
# ----------------------------------------------------------------------------


def create_missing_landing_pages(apps, schema_editor):
    BusinessAccount = apps.get_model("accounts", "BusinessAccount")
    LandingPage = apps.get_model("landingpages", "LandingPage")

    for account in BusinessAccount.objects.filter(landing_page__isnull=True):
        base = base_address_for_business(account.business_name, account.pk)
        slug = base
        suffix = 2
        while LandingPage.objects.filter(slug=slug).exists():
            slug = f"{base}-{suffix}"  # same rule as signup: -2, -3, ... for a name already taken
            suffix += 1
        LandingPage.objects.create(business_account=account, slug=slug)


class Migration(migrations.Migration):

    dependencies = [
        ("landingpages", "0006_landingpage_hero_mark"),
        ("accounts", "0008_businessaccount_city_businessaccount_state_and_more"),
    ]

    # Going backwards does nothing. Removing the pages again would break any
    # links people already have, so the pages stay.
    operations = [migrations.RunPython(create_missing_landing_pages, migrations.RunPython.noop)]
