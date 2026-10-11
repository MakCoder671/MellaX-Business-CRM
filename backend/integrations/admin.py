from django.contrib import admin

from .models import IntegrationConnection, IntegrationEntitlement

# Until billing is built, you can grant a one-time purchase here by hand, to
# test an advanced integration or to comp an account.
admin.site.register(IntegrationEntitlement)
admin.site.register(IntegrationConnection)
