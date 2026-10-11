import re

from .models import Client

# ----------------------------------------------------------------------------
# How an online booking decides "this is someone we already know." A visitor can
# type the same person in differently (another email, the phone written with
# dashes or spaces), and without this they'd get a second client record.
#
# Email is checked first. Phone is only a fallback, and only digits are compared,
# so formatting doesn't matter. Names never match on their own, since two people
# can share a name. A match never overwrites what's already saved on the client.
# ----------------------------------------------------------------------------

MIN_PHONE_DIGITS = 7  # shorter numbers are too easy to match by accident


def _digits(value):
    return re.sub(r"\D", "", value or "")


def _same_phone(saved, typed):
    saved_digits, typed_digits = _digits(saved), _digits(typed)
    if len(saved_digits) < MIN_PHONE_DIGITS or len(typed_digits) < MIN_PHONE_DIGITS:
        return False
    if len(saved_digits) >= 10 and len(typed_digits) >= 10:
        # Compare the last 10 digits so "+1 555 201 4488" and "(555) 201-4488" agree.
        return saved_digits[-10:] == typed_digits[-10:]
    return saved_digits == typed_digits


def find_existing_client(account, email, phone):
    clients = Client.objects.for_account(account)
    if email:
        match = clients.filter(email__iexact=email).first()
        if match is not None:
            return match
    if phone:
        for client in clients.exclude(phone="").order_by("pk"):
            if _same_phone(client.phone, phone):
                return client
    return None


def fill_blank_fields(client, **values):
    # Only fills fields that are empty on the client. Anything already saved stays
    # as it is, even if the booking typed something different.
    changed = []
    for field, value in values.items():
        if value and not getattr(client, field):
            setattr(client, field, value)
            changed.append(field)
    if changed:
        client.save(update_fields=changed)
