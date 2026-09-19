from django.contrib import admin

from .models import Appointment, BusinessHours, Calendar

admin.site.register(Calendar)
admin.site.register(Appointment)
admin.site.register(BusinessHours)
