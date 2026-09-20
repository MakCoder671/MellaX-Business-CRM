# Dropping accent_color — a single color picker was a placeholder for
# real theming; Mako's building a proper Theme tab for that instead of
# keeping a field nothing in the UI reads anymore.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_businessaccount_allow_double_booking_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='businessaccount',
            name='accent_color',
        ),
    ]
