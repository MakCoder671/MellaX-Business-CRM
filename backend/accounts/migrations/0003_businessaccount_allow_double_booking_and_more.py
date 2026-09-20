# Auto-generated after adding allow_double_booking and
# default_calendar_view to BusinessAccount (see accounts/models.py) —
# plain schema migration, two new columns, no data to backfill.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_businessaccount_accent_color_businessaccount_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='businessaccount',
            name='allow_double_booking',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='businessaccount',
            name='default_calendar_view',
            field=models.CharField(choices=[('day', 'Day'), ('week', 'Week'), ('month', 'Month')], default='month', max_length=5),
        ),
    ]
