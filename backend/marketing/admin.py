from django.contrib import admin

from .models import EBlast


@admin.register(EBlast)
class EBlastAdmin(admin.ModelAdmin):
    list_display = ("subject", "business_account", "sent_at", "recipient_count")
