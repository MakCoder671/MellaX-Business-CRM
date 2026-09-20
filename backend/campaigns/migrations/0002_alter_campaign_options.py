# Auto-generated after adding Meta.ordering to Campaign (see
# campaigns/models.py). AlterModelOptions is a special case: it changes
# no actual database columns — ordering is applied at query time, not
# stored anywhere — but Django still records it as a migration so the
# model's full history (including non-schema options) stays in one place.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='campaign',
            options={'ordering': ['-created_at']},
        ),
    ]
