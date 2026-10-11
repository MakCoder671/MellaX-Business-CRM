from decimal import Decimal

from .models import Discount

# ----------------------------------------------------------------------------
# The one place invoice totals are calculated for a set of line items. Saving an
# invoice and previewing it on the create screen both use this, so the numbers
# the owner sees before they take a payment are the numbers that get saved.
#
# The rounding rules are the same as the saved invoice (see invoicing/models.py):
#   - each line keeps full precision,
#   - the subtotal and the tax are rounded to the cent,
#   - the invoice discount is worked out on (subtotal + tax) and rounded to the cent,
#   - the total is rounded to the cent last.
# ----------------------------------------------------------------------------

CENTS = Decimal("0.01")


def line_net(quantity, unit_price, discount_type, discount_value):
    gross = quantity * unit_price
    if not discount_value:
        return gross
    if discount_type == "flat":
        return gross - min(discount_value, gross)
    return gross - (gross * discount_value / Decimal("100"))


def compute_totals(account, lines, discount):
    """
    lines: each one is a dict with service (a Service), quantity, unit_price,
    discount_type ("flat" or "percent"), and discount_value (or None).
    discount: the invoice-wide Discount, or None.
    """
    subtotal_raw = Decimal("0")
    tax_raw = Decimal("0")
    line_nets = []
    for line in lines:
        net = line_net(line["quantity"], line["unit_price"], line.get("discount_type"), line.get("discount_value"))
        line_nets.append(net)
        subtotal_raw += net
        service = line["service"]
        if service.is_taxable:
            rate = account.product_tax_percent if service.is_product else account.service_tax_percent
            tax_raw += net * (rate / Decimal("100"))

    subtotal = subtotal_raw.quantize(CENTS)
    tax = tax_raw.quantize(CENTS)
    pre_discount = subtotal + tax

    discount_amount = Decimal("0")
    if discount is not None:
        if discount.type == Discount.TYPE_FLAT:
            discount_amount = min(discount.amount, pre_discount)
        else:
            discount_amount = pre_discount * discount.amount / Decimal("100")
        discount_amount = discount_amount.quantize(CENTS)

    total = (pre_discount - discount_amount).quantize(CENTS)
    return {
        "subtotal": subtotal,
        "tax": tax,
        "discount": discount_amount,
        "total": total,
        "line_nets": [n.quantize(CENTS) for n in line_nets],
    }
