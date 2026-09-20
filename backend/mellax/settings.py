"""
Django settings for the MellaX backend.

This is THE config file for the whole Django project — which apps are
installed, how the database connects, security settings, etc. Django
reads this file once when the server starts.

See business_plan.MD (Data Structure, Account Creation & Security) for
the domain/security rules a lot of this configuration exists to enforce.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent  # the /backend folder itself

# ----------------------------------------------------------------------------
# django-environ lets us read config from a .env file instead of hardcoding
# secrets/settings directly in this Python file (which would get committed
# to git!). See .env.example for the template — copy it to .env and it
# gets picked up automatically. Different environments (your laptop vs. a
# real production server) just need different .env files, no code changes.
# ----------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, False),  # tells django-environ "DEBUG should be read as a boolean, defaulting to False if unset"
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-only-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ----------------------------------------------------------------------------
# Every Django "app" (a self-contained chunk of functionality, usually one
# per folder — accounts, clients, invoicing, etc) has to be registered
# here or Django won't know it exists. The first several entries are
# built into Django itself; ours start after "corsheaders".
# ----------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",  # the /admin/ site
    "django.contrib.auth",  # Django's user/permissions system (we're using BusinessAccount as our User model)
    "django.contrib.contenttypes",  # supporting framework auth/admin need
    "django.contrib.sessions",  # session-based login (used by the admin site)
    "django.contrib.messages",  # one-time "flash" messages (mostly an admin-site thing)
    "django.contrib.staticfiles",  # serves CSS/JS for the admin site in development
    "rest_framework",  # Django REST Framework - turns Django into a JSON API
    "rest_framework.authtoken",  # gives us the Token model used for login (see accounts/views.py)
    "corsheaders",  # lets the Next.js frontend (a different origin/port) actually call this API from a browser
    "common",  # our shared tenant-scoping code
    "accounts",
    "clients",
    "services",
    "invoicing",
    "scheduling",
    "landingpages",
    "reports",
    "marketing",
    "campaigns",
]

# ----------------------------------------------------------------------------
# Middleware runs on EVERY request/response, in order, like a pipeline.
# Order actually matters here — e.g. CorsMiddleware has to run early
# enough to add its headers before the response is finalized.
# ----------------------------------------------------------------------------
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "mellax.urls"  # points Django at the top-level urls.py that routes everything

TEMPLATES = [
    {
        # We don't really use Django's HTML templating (the frontend is a
        # separate Next.js app) — this config exists mainly because the
        # admin site needs it under the hood.
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "mellax.wsgi.application"  # the entry point a production server (gunicorn, etc) would use to run this app

# ----------------------------------------------------------------------------
# env.db(...) parses a single DATABASE_URL string (like
# "postgres://user:pass@host/dbname") into Django's DATABASES config
# format. Defaults to a local SQLite file if DATABASE_URL isn't set,
# which is perfect for development — zero setup needed. Production would
# point DATABASE_URL at a real Postgres database (per the plan doc).
# ----------------------------------------------------------------------------
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
}

# Tells Django "use OUR BusinessAccount model as the user/auth model"
# instead of its built-in default User model.
AUTH_USER_MODEL = "accounts.BusinessAccount"

# Django's built-in password strength rules — nothing custom here, just
# the standard "not too similar to your email," "not too short," etc.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"  # the SERVER's timezone — individual accounts have their own `time_zone` field for displaying times correctly
USE_I18N = True
USE_TZ = True  # store all datetimes in the database as UTC, convert for display as needed — avoids a world of timezone bugs

STATIC_URL = "static/"  # for admin-site CSS/JS
MEDIA_URL = "media/"  # for user-uploaded files, like landing page photos
MEDIA_ROOT = BASE_DIR / "media"  # where those uploaded files actually live on disk

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"  # what kind of auto-incrementing ID field new models get by default

# ----------------------------------------------------------------------------
# Django REST Framework's own settings. These apply to every API endpoint
# in the whole project unless a specific view overrides them.
# ----------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # DRF tries these in order to figure out who's making a request:
        "rest_framework.authentication.SessionAuthentication",  # cookie-based, mostly for the browsable API / admin
        "rest_framework.authentication.TokenAuthentication",  # the "Authorization: Token xyz" header the frontend actually uses
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        # By default, every endpoint requires being logged in. Individual
        # views (like signup, login, the public landing page) explicitly
        # opt OUT of this with permission_classes = [AllowAny] — meaning
        # the safe default is "locked," and you have to deliberately
        # choose to open something up, not the other way around.
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Basic brute-force/enumeration protection on signup/login/password
        # reset (business_plan.MD, Account Creation & Security, principle 6).
        # See accounts/views.py's AuthRateThrottle for where this gets used.
        "auth": "10/min",
    },
}

# Which frontend origins are allowed to call this API from a browser.
# Without this, the browser's own security (CORS) would block Next.js
# running on localhost:3000 from talking to Django on localhost:8001.
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:3000"]
)

# In development this just prints emails to the terminal instead of
# actually sending them — see .env.example for swapping in a real email
# provider later.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)

# Where email links (verification, password reset) point — the Next.js
# frontend, not this API. See accounts/views.py.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
