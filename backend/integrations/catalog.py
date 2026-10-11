from .guides import GUIDES

PLAN_BASIC = "basic"
PLAN_PLUS = "plus"
PLAN_PREMIUM = "premium"
ALL_PLANS = (PLAN_BASIC, PLAN_PLUS, PLAN_PREMIUM)

# ----------------------------------------------------------------------------
# The integrations store. Every plan sees every entry here. What each plan can
# actually connect is worked out by access_for() below, and the server checks
# it again on every connect, so the page can't be tricked into skipping it.
#
#   essential  -> free on the plans listed in included_plans
#   advanced   -> one-time purchase on Basic and Plus, free on Premium
#
# Sync is one way (MellaX sends data out) unless an entry says "two_way".
# "available" is False until that integration's credentials are set up on the
# server. Those entries still show, with their steps, so owners know what's coming.
# ----------------------------------------------------------------------------

CATALOG = [
    {
        "key": "apple_calendar",
        "name": "Apple Calendar",
        "category": "Calendars",
        "tier": "essential",
        "included_plans": ALL_PLANS,
        "sync": "one_way",
        "available": True,
        "tagline": "See your MellaX appointments in Apple Calendar on every Apple device.",
        "fields": [
            {"name": "apple_id", "label": "Apple ID email", "type": "email"},
            {
                "name": "app_password",
                "label": "App specific password",
                "type": "password",
                "help": "This isn't your normal Apple password. Create one at account.apple.com.",
            },
        ],
    },
    {
        "key": "google_calendar",
        "name": "Google Calendar",
        "category": "Calendars",
        "tier": "essential",
        "included_plans": ALL_PLANS,
        "sync": "one_way",
        "available": False,
        "tagline": "Send your MellaX appointments to Google Calendar, on your phone and computer.",
        "fields": [],
    },
    {
        "key": "square",
        "name": "Square",
        "category": "Payments",
        "tier": "essential",
        "included_plans": ("plus", "premium"),
        "sync": "two_way",
        "available": False,
        "tagline": "Show how every invoice was paid, right down to the card.",
        "fields": [],
    },
    {
        "key": "stripe",
        "name": "Stripe",
        "category": "Payments",
        "tier": "essential",
        "included_plans": ("plus", "premium"),
        "sync": "two_way",
        "available": True,
        "tagline": "Take card payments through your own Stripe account and see them on each invoice.",
        "fields": [
            {
                "name": "secret_key",
                "label": "Restricted key (starts with rk_)",
                "type": "password",
                "help": "Create it in your Stripe Dashboard under Developers, then API keys.",
            },
            {
                "name": "publishable_key",
                "label": "Publishable key (starts with pk_)",
                "type": "text",
                "help": "Found on the same Stripe page. It isn't secret.",
            },
        ],
    },
    {
        "key": "clover",
        "name": "Clover",
        "category": "Payments",
        "tier": "essential",
        "included_plans": ("plus", "premium"),
        "sync": "two_way",
        "available": False,
        "tagline": "Show every payment taken on your Clover device, right down to the card.",
        "fields": [],
    },
    {
        "key": "zapier",
        "name": "Zapier",
        "category": "Automation",
        "tier": "advanced",
        "included_plans": ("premium",),
        "sync": "one_way",
        "available": True,
        "tagline": "Send MellaX events to thousands of other apps.",
        "fields": [
            {"name": "webhook_url", "label": "Zapier webhook link", "type": "text", "help": "Starts with https://hooks.zapier.com/. Zapier shows it when you add a Catch Hook trigger."},
        ],
    },
    {
        "key": "slack",
        "name": "Slack",
        "category": "Messaging",
        "tier": "advanced",
        "included_plans": ("premium",),
        "sync": "one_way",
        "available": True,
        "tagline": "Get a Slack message when someone books or pays.",
        "fields": [
            {"name": "webhook_url", "label": "Slack webhook link", "type": "text", "help": "Starts with https://hooks.slack.com/. Slack shows it when you add the Incoming Webhooks app."},
        ],
    },
    {
        "key": "mailchimp",
        "name": "Mailchimp",
        "category": "Marketing",
        "tier": "advanced",
        "included_plans": ("premium",),
        "sync": "one_way",
        "available": True,
        "tagline": "Add new clients to your Mailchimp list automatically.",
        "fields": [
            {"name": "api_key", "label": "Mailchimp API key", "type": "password", "help": "Ends in a code like -us21. Create one in your Mailchimp profile under Extras, then API keys."},
            {"name": "audience_id", "label": "Audience ID", "type": "text", "help": "Found in Mailchimp under Audience, then Settings, then Audience name and defaults."},
        ],
    },
]

# Every entry gets its written guide, so the store and the server always agree.
for _entry in CATALOG:
    _entry["guide"] = GUIDES[_entry["key"]]

# What the owner can do with an entry on their plan.
ACCESS_INCLUDED = "included"  # free on this plan, connect now
ACCESS_OWNED = "owned"  # bought already, connect now
ACCESS_ONE_TIME = "one_time"  # buy once to connect
ACCESS_UPGRADE = "upgrade"  # needs the Plus plan


def find(key):
    for entry in CATALOG:
        if entry["key"] == key:
            return entry
    return None


def access_for(entry, plan_tier, owned_keys):
    # Free on this plan? Then that's all there is to it.
    if plan_tier in entry["included_plans"]:
        return ACCESS_INCLUDED
    # Advanced integrations can be bought once, on any plan below Premium.
    if entry["tier"] == "advanced":
        return ACCESS_OWNED if entry["key"] in owned_keys else ACCESS_ONE_TIME
    # Everything else (like Square) is a Plus feature, so Basic is asked to upgrade.
    return ACCESS_UPGRADE
