# Step 3 of 3: now that migration 0003 has copied every existing
# client's `name` into first_name/last_name, the old column can finally
# go. Depends on 0003 specifically (not just "whatever's latest") so
# Django can never apply this before the data's actually been migrated.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0003_split_name_into_first_last'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='client',
            name='name',
        ),
    ]
