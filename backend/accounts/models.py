from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models

# ----------------------------------------------------------------------------
# In MellaX, a "user" and a "business" are the same thing — there's no
# separate concept of multiple employees logging into one business account
# (that's a planned future feature, not v1). So instead of Django's normal
# User model plus a separate Business model linked to it, we just make
# BusinessAccount BE the user model. Simpler for now, matches the "single
# user per business" rule in the plan doc.
#
# This file has two pieces:
#   1. BusinessAccountManager — teaches Django how to create a
#      BusinessAccount (since we're not using its default User creation)
#   2. BusinessAccount — the actual model/table
# ----------------------------------------------------------------------------


class BusinessAccountManager(BaseUserManager):
    """
    Django's auth system expects a manager with create_user() and
    create_superuser() methods — this is what gets called by
    `BusinessAccount.objects.create_user(...)` and by the
    `python manage.py createsuperuser` command.
    """

    def create_user(self, email, business_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        if not business_name:
            raise ValueError("Business name is required")

        email = self.normalize_email(email)  # lowercases the domain part, e.g. Example@GMAIL.com -> Example@gmail.com
        account = self.model(email=email, business_name=business_name, **extra_fields)
        account.set_password(password)  # hashes the password — never store it as plain text!
        account.save(using=self._db)
        return account

    def create_superuser(self, email, business_name, password=None, **extra_fields):
        # This is what makes an account able to log into /admin/ and see everything.
        # Only used for you (the site owner), never for a regular business signup.
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_email_verified", True)
        return self.create_user(email, business_name, password, **extra_fields)


class BusinessAccount(AbstractBaseUser, PermissionsMixin):
    """
    The core "who is logging in" model. Every other table in the app
    (clients, services, invoices, etc.) has a business_account foreign key
    pointing back to one of these rows.

    AbstractBaseUser gives us password hashing + login-related fields.
    PermissionsMixin gives us Django's groups/permissions system (mostly
    used for the admin site, not the main app).
    """

    PLAN_BASIC = "basic"
    PLAN_PLUS = "plus"
    PLAN_PREMIUM = "premium"
    PLAN_CHOICES = [
        (PLAN_BASIC, "Basic"),
        (PLAN_PLUS, "Plus"),
        (PLAN_PREMIUM, "Premium"),
    ]

    # --- Core identity ---
    email = models.EmailField(unique=True)  # this is what they log in with, not a username
    business_name = models.CharField(max_length=255)
    plan_tier = models.CharField(max_length=10, choices=PLAN_CHOICES, default=PLAN_BASIC)

    # --- Business Information (shows up in Settings, feeds invoices/landing page) ---
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)

    # --- Branding (Settings section) ---
    # Shows up on invoices, the public landing page, marketing e-blasts,
    # and in the dashboard's own sidebar once logged in.
    logo = models.ImageField(upload_to="logos/", null=True, blank=True)

    # --- Theme (Settings > Theme) ---
    # Deliberately pre-made choices, not a free-form color picker — most
    # business owners aren't designers, and letting them blend arbitrary
    # colors just leads to bad-looking (or unreadable) combinations. Each
    # choice maps to a real set of colors defined once on the frontend
    # (src/lib/themePresets.ts) — this field just stores WHICH preset, not
    # the colors themselves, so the actual palette can be tweaked without
    # a migration.
    # 14 curated color families — solid and gradient — covering the color
    # wheel with enough real variety that "way more options" actually
    # means something, while staying a pick-from-a-list so nothing ends
    # up an unreadable custom blend. See src/lib/themePresets.ts for the
    # actual hex values each id maps to.
    THEME_ACCENT_CHOICES = [
        ("emerald", "Emerald"),
        ("teal", "Teal"),
        ("ocean", "Ocean"),
        ("lagoon", "Lagoon"),
        ("indigo", "Indigo"),
        ("grape", "Grape"),
        ("twilight", "Twilight"),
        ("berry", "Berry"),
        ("rose", "Rose"),
        ("crimson", "Crimson"),
        ("sunset", "Sunset"),
        ("amber", "Amber"),
        ("slate", "Slate"),
        ("midnight", "Midnight"),
    ]
    # "Buttons" — the app's primary-button color (also used for focus
    # rings and the little "selected"/active-tab indicators scattered
    # around Settings, Reports, Marketing, etc). Independent of
    # calendar_accent below, so a business can mix and match — a purple
    # button color with a green calendar, say — without the two fighting
    # each other.
    theme_accent = models.CharField(max_length=20, choices=THEME_ACCENT_CHOICES, default="emerald")

    # "Background" — the page background behind the dashboard's content.
    # Three flavors, organized into their own tabs on the frontend: a
    # flat tint (the palest shade of one of the 14 families above), a
    # soft two-tone gradient, or a whole illustrated scene ("Design" —
    # e.g. an actual palm-tree horizon, a sunset) for businesses who want
    # more personality than a plain color gives. See themePresets.ts.
    #
    # The sidebar deliberately does NOT get its own separate color choice
    # any more — it automatically matches whatever's picked here (see
    # NAV_MATCH_FOR_BACKGROUND in themePresets.ts), so there's no way to
    # end up with a sidebar and background that clash.
    THEME_BACKGROUND_CHOICES = (
        [("default", "Default")]
        + [(f"{accent_id}-tint", f"{label} Tint") for accent_id, label in THEME_ACCENT_CHOICES]
        + [
            ("ocean", "Ocean Theme"),
            ("jungle", "Jungle Theme"),
            ("sunset", "Sunset Theme"),
            ("berry", "Berry Theme"),
            ("amber", "Amber Theme"),
            ("tropical", "Tropical"),
            ("horizon", "Sunset Horizon"),
            ("waves", "Ocean Waves"),
            ("summit", "Mountain Summit"),
        ]
    )
    theme_background = models.CharField(max_length=20, choices=THEME_BACKGROUND_CHOICES, default="default")

    # Same preset list as theme_accent, reused here rather than a second
    # separate list — it's the same "pick a color family" mechanic, just
    # applied to a different surface (every colored area of the Calendar
    # widget: appointment blocks, today's highlight, the selected day,
    # the Day/Week/Month toggle) instead of the whole app's chrome.
    calendar_accent = models.CharField(max_length=20, choices=THEME_ACCENT_CHOICES, default="emerald")

    # --- Calendar Settings (Settings section) ---
    # Double-booking toggle: off (default) means the backend rejects a new
    # appointment that overlaps an existing one on the same calendar — see
    # scheduling/serializers.py's AppointmentSerializer for where that's
    # actually enforced. On means overlapping appointments are allowed.
    allow_double_booking = models.BooleanField(default=False)

    VIEW_DAY = "day"
    VIEW_WEEK = "week"
    VIEW_MONTH = "month"
    CALENDAR_VIEW_CHOICES = [
        (VIEW_DAY, "Day"),
        (VIEW_WEEK, "Week"),
        (VIEW_MONTH, "Month"),
    ]
    # Which of Day/Week/Month the dashboard Calendar widget opens to by
    # default — purely a starting point, the viewer can still switch to
    # either of the other two any time from the toggle on the widget itself.
    default_calendar_view = models.CharField(max_length=5, choices=CALENDAR_VIEW_CHOICES, default=VIEW_MONTH)

    # --- Invoice Settings (see business_plan.MD, Settings section) ---
    # These live here on the account instead of a separate "Settings" model
    # because they're one-per-account, simple values — no need for a whole
    # extra table just to hold six fields.
    service_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    product_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    invoice_prefix = models.CharField(max_length=16, default="INV-")
    next_invoice_sequence = models.PositiveIntegerField(default=1001)  # bumped by 1 every time an invoice is made
    default_invoice_terms = models.TextField(blank=True, default="Payment due upon receipt.")
    time_zone = models.CharField(max_length=64, default="UTC")

    # --- Signup / account status flags ---
    accepted_tos_at = models.DateTimeField(null=True, blank=True)  # timestamp of "I agree to the Terms" checkbox
    is_email_verified = models.BooleanField(default=False)  # can't log in until this flips to True

    is_active = models.BooleanField(default=True)  # Django's "is this account allowed to log in at all" flag
    is_staff = models.BooleanField(default=False)  # can this account access the Django /admin/ site
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BusinessAccountManager()

    # Tells Django's auth system: "log in with email, not username"
    USERNAME_FIELD = "email"
    # Extra fields required when creating a superuser via the CLI (email + password are always required anyway)
    REQUIRED_FIELDS = ["business_name"]

    def __str__(self):
        # Whatever this returns is what shows up in the Django admin's list view,
        # and anywhere Python tries to print a BusinessAccount object.
        return self.business_name
