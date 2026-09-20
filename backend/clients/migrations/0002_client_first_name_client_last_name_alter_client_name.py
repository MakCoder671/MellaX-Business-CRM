# Step 1 of 3 in splitting Client.name into first_name/last_name: just
# adds the two new columns and makes the old `name` column optional —
# deliberately NOT removing `name` yet, so migration 0003 (a data
# migration) still has it around to read old values from. Migration 0004
# is the one that actually removes `name`, once nothing needs it anymore.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='first_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='client',
            name='last_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='client',
            name='name',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
