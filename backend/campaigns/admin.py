from django.contrib import admin

from .models import Campaign, Lead


class LeadInline(admin.TabularInline):
    model = Lead
    extra = 0


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "business_account", "click_count", "qr_scan_count", "cost")
    inlines = [LeadInline]


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("name", "campaign", "status", "created_at")
