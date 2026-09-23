import os
import django
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mellax.settings")
django.setup()

from django.utils import timezone
from accounts.models import BusinessAccount
from services.models import Service
from marketing.models import EBlast
from campaigns.models import Campaign, Lead

email = "demo@mellax.test"
account, created = BusinessAccount.objects.get_or_create(
    email=email,
    defaults={"business_name": "Demo Salon", "plan_tier": "premium"},
)
account.plan_tier = "premium"
account.set_password("demopass123")
account.save()

if not Service.objects.filter(business_account=account).exists():
    Service.objects.create(business_account=account, name="Haircut", price="45.00", description="Classic cut & style", is_taxable=True)
    Service.objects.create(business_account=account, name="Color", price="120.00", description="Full color treatment", is_taxable=True)
    Service.objects.create(business_account=account, name="Blowout", price="35.00", description="Wash and style", is_taxable=True)

if not Service.objects.filter(business_account=account, is_product=True).exists():
    Service.objects.create(business_account=account, name="Shampoo", price="18.00", description="Sulfate-free, 8oz", is_taxable=True, is_product=True, stock_quantity=4, low_stock_threshold=5)
    Service.objects.create(business_account=account, name="Conditioner", price="20.00", description="Deep repair conditioner", is_taxable=True, is_product=True, stock_quantity=30, low_stock_threshold=8)
    Service.objects.create(business_account=account, name="Hair Oil", price="28.00", description="Argan oil serum", is_taxable=True, is_product=True, stock_quantity=12, low_stock_threshold=5)

if not EBlast.objects.filter(business_account=account).exists():
    now = timezone.now()
    EBlast.objects.create(business_account=account, subject="Spring Specials!", body="Book a color treatment this month and get 15% off.", template_key="promo", sent_at=now - timedelta(days=20), recipient_count=42)
    EBlast.objects.create(business_account=account, subject="We missed you", body="It's been a while. Come back for a free blowout with any service.", template_key="winback", sent_at=now - timedelta(days=10), recipient_count=58)
    EBlast.objects.create(business_account=account, subject="Holiday Hours", body="Updated hours for the holidays.", template_key="announcement", sent_at=now - timedelta(days=2), recipient_count=71)
    EBlast.objects.create(business_account=account, subject="New Product Line", body="Draft: announcing our new product line.", template_key="promo", sent_at=None, recipient_count=0)

if not Campaign.objects.filter(business_account=account).exists():
    c1 = Campaign.objects.create(business_account=account, name="Instagram Promo", cost="150.00", details="Boosted post", click_count=120, qr_scan_count=15)
    c2 = Campaign.objects.create(business_account=account, name="Flyer Drop", cost="60.00", details="Downtown flyers", click_count=20, qr_scan_count=48)
    c3 = Campaign.objects.create(business_account=account, name="Referral Cards", cost="0.00", details="Handed out at checkout", click_count=8, qr_scan_count=22)
    for camp, n_new, n_contacted, n_converted in [(c1, 3, 2, 4), (c2, 5, 1, 2), (c3, 2, 0, 1)]:
        for i in range(n_new):
            Lead.objects.create(business_account=account, campaign=camp, name=f"New Lead {i}", email=f"new{i}@example.com", status="new")
        for i in range(n_contacted):
            Lead.objects.create(business_account=account, campaign=camp, name=f"Contacted Lead {i}", email=f"contacted{i}@example.com", status="contacted")
        for i in range(n_converted):
            Lead.objects.create(business_account=account, campaign=camp, name=f"Converted Lead {i}", email=f"converted{i}@example.com", status="converted")

print("Seed complete. Login with:", email, "/ demopass123")
