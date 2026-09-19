from django.contrib import admin

from .models import Client

# The simplest possible admin registration — just makes Client show up
# in the /admin/ site with Django's default list/edit views. No custom
# columns or search needed for something this simple.
admin.site.register(Client)
