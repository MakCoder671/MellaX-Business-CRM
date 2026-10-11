# ----------------------------------------------------------------------------
# The expense categories from IRS Schedule C (Form 1040), the form sole
# proprietors and single-member LLCs file for their business income and
# expenses. The same list applies in every US state and territory that follows
# federal tax rules. Each category keeps its Schedule C line number, so the
# year-end summary can be handed straight to an accountant.
#
# Meals are listed on their own. The deductible part of meal costs is usually
# half, but that's the accountant's call, so the app records the full amount.
# ----------------------------------------------------------------------------

SCHEDULE_C_CATEGORIES = [
    # (key, label, Schedule C line, short plain-language hint)
    ("advertising", "Advertising", "8", "Ads, flyers, sponsored posts, Google or Facebook ads, business cards"),
    ("car_and_truck", "Car and truck", "9", "Mileage or fuel, parking, and repairs for a vehicle used for business"),
    ("commissions_and_fees", "Commissions and fees", "10", "Payment processing fees that aren't already taken out of payments, booking app fees"),
    ("contract_labor", "Contract labor", "11", "Freelancers or contractors you pay, not employees"),
    ("depreciation", "Depreciation", "13", "Big purchases spread over several years, like equipment (your accountant sets this)"),
    ("employee_benefits", "Employee benefit programs", "14", "Benefits you pay for employees, other than their wages"),
    ("insurance", "Insurance (not health)", "15", "Liability, property, or business insurance"),
    ("interest", "Interest", "16", "Interest on a business loan or business credit card"),
    ("legal_and_professional", "Legal and professional services", "17", "Accountant, bookkeeper, tax preparer, lawyer, consultant"),
    ("office_expense", "Office expense", "18", "Software subscriptions, postage, printer ink, small office items"),
    ("pension_and_profit_sharing", "Pension and profit-sharing plans", "19", "Retirement contributions made for employees"),
    ("rent_vehicles_equipment", "Rent: vehicles and equipment", "20a", "Renting a vehicle or equipment for the business"),
    ("rent_other", "Rent: property", "20b", "Rent for a studio, chair, booth, or office space"),
    ("repairs_and_maintenance", "Repairs and maintenance", "21", "Fixing or servicing equipment, like a lawn mower tune-up or a chair repair, and fixing the space you work in"),
    ("supplies", "Supplies", "22", "Items you use up, like towels, gloves, products, or cleaning supplies"),
    ("taxes_and_licenses", "Taxes and licenses", "23", "Business licenses, permits, and business taxes (not income tax)"),
    ("travel", "Travel", "24a", "Flights, hotels, and travel to a business event or client"),
    ("meals", "Meals", "24b", "Meals on business trips or with clients. Your accountant sets the deductible part"),
    ("utilities", "Utilities", "25", "Phone, internet, electricity, or water for the business"),
    ("wages", "Wages", "26", "Pay for employees. Not your own pay as a sole proprietor"),
    ("other", "Other expenses", "27a", "Anything that doesn't fit above. Describe it clearly in the description"),
]

CATEGORY_KEYS = [key for key, _, _, _ in SCHEDULE_C_CATEGORIES]
CATEGORY_LABELS = {key: label for key, label, _, _ in SCHEDULE_C_CATEGORIES}
CATEGORY_LINES = {key: line for key, _, line, _ in SCHEDULE_C_CATEGORIES}
