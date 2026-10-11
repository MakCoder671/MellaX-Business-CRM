from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    name = "integrations"

    def ready(self):
        # Importing signals connects the appointment hooks that keep calendars in step.
        from . import signals  # noqa: F401
