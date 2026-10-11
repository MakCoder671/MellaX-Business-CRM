from django.apps import AppConfig


class LandingpagesConfig(AppConfig):
    name = 'landingpages'

    def ready(self):
        # Importing the signals module connects the "new account, new page" hook.
        from . import signals  # noqa: F401
