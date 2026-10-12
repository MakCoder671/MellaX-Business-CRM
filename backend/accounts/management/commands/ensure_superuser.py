import os

from django.core.management.base import BaseCommand

from accounts.models import BusinessAccount

# ----------------------------------------------------------------------------
# Creates (or fixes up) one superuser from env vars - meant to run as part
# of every deploy (see render.yaml's buildCommand), not by hand. This is
# the free-tier-friendly way to get into /admin/ on a host like Render,
# where Shell access needs a paid plan: set three env vars once in the
# dashboard, and the next deploy just makes the account for you.
#
# Safe to run on every single deploy, unlike Django's own
# `createsuperuser --noinput` - that one errors out the second time (the
# email already exists). This uses get_or_create and just makes sure the
# account is a real superuser, so running it 50 times is harmless.
#
# If the three env vars below aren't set at all, this does nothing and
# exits quietly - so leaving it in the build command is always safe,
# even for local dev where you'd never set these.
# ----------------------------------------------------------------------------


class Command(BaseCommand):
    help = "Creates a superuser from DJANGO_SUPERUSER_EMAIL/PASSWORD/BUSINESS_NAME env vars, if they're set."

    def handle(self, *args, **options):
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "").strip()
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
        business_name = os.environ.get("DJANGO_SUPERUSER_BUSINESS_NAME", "Owner").strip()

        if not email or not password:
            self.stdout.write("DJANGO_SUPERUSER_EMAIL/PASSWORD not set - skipping.")
            return

        account, created = BusinessAccount.objects.get_or_create(
            email=email.lower(),
            defaults={"business_name": business_name},
        )
        account.business_name = account.business_name or business_name
        account.set_password(password)
        account.is_staff = True
        account.is_superuser = True
        account.is_email_verified = True
        account.is_active = True
        account.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} superuser {email}."))
