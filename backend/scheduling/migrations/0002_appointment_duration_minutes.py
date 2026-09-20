# Auto-generated after adding duration_minutes to Appointment (see
# scheduling/models.py) — a plain schema migration, one new column,
# defaulting existing rows to 60 minutes since we don't actually know
# how long past appointments ran.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='duration_minutes',
            field=models.PositiveIntegerField(default=60),
        ),
    ]
