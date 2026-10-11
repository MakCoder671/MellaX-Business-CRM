from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import BusinessAccount

from .models import LandingPage
from .slugs import address_for_business

# ----------------------------------------------------------------------------
# Every account gets its own landing page the moment the account exists. This
# signal is what makes that true for every way an account gets created: the
# signup form, the admin site, a management command, or a test. Before this,
# only the signup form made a page, so any other path left the account without
# one.
# ----------------------------------------------------------------------------


@receiver(post_save, sender=BusinessAccount)
def create_landing_page_for_new_account(sender, instance, created, **kwargs):
    if not created:
        return  # only brand-new accounts. Editing an account never makes a second page.
    # get_or_create keeps this safe if a page already exists for the account.
    LandingPage.objects.get_or_create(
        business_account=instance,
        defaults={"slug": address_for_business(instance.business_name, instance.pk)},
    )
