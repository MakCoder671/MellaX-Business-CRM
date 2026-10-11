from django.utils.text import slugify

from .models import LandingPage

# ----------------------------------------------------------------------------
# The landing page address. It's built from the business name when the account
# is created and never changes after that. Owners can't edit it, because it's
# part of the software they signed up for, and a changed address would break
# links people already have.
# ----------------------------------------------------------------------------

RESERVED_SLUGS = {"api", "admin", "dashboard", "l", "login", "signup", "static", "media"}  # would clash with real app routes like /l/<slug>
MIN_SLUG_LENGTH = 3


def base_address_for_business(business_name, account_pk):
    # The address before any "-2" suffix is added. Kept separate so the data
    # migration can use the same rule with its own copy of the model.
    base = slugify(business_name or "")
    if len(base) < MIN_SLUG_LENGTH or base in RESERVED_SLUGS:
        base = f"business-{account_pk}"  # a name like "&" or "Api" would give an unusable or reserved address
    return base


def address_for_business(business_name, account_pk):
    base = base_address_for_business(business_name, account_pk)
    slug = base
    suffix = 2
    while LandingPage.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"  # two businesses with the same name get -2, -3, ...
        suffix += 1
    return slug
