from django.contrib import admin

from .models import LandingPage, LandingPagePhoto


class LandingPagePhotoInline(admin.TabularInline):
    model = LandingPagePhoto
    extra = 0


@admin.register(LandingPage)
class LandingPageAdmin(admin.ModelAdmin):
    list_display = ("slug", "business_account", "booking_enabled")
    inlines = [LandingPagePhotoInline]
