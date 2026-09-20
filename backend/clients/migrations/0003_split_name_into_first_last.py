# Step 2 of 3: a data migration (not a schema change) that backfills the
# new first_name/last_name columns from the old `name` column, for any
# clients that already existed before this split. Split on the first
# space: "Jane Doe" -> first="Jane", last="Doe". A name with no space at
# all just goes entirely into first_name, leaving last_name blank rather
# than guessing wrong — better an empty field a business can fill in
# themselves than a made-up last name.

from django.db import migrations


def split_names(apps, schema_editor):
    Client = apps.get_model("clients", "Client")
    for client in Client.objects.exclude(name=""):
        parts = client.name.strip().split(" ", 1)
        client.first_name = parts[0]
        client.last_name = parts[1] if len(parts) > 1 else ""
        client.save(update_fields=["first_name", "last_name"])


def rejoin_names(apps, schema_editor):
    # The reverse of the above, in case this migration ever needs to be
    # rolled back — reconstructs `name` from the two split fields.
    Client = apps.get_model("clients", "Client")
    for client in Client.objects.all():
        client.name = f"{client.first_name} {client.last_name}".strip()
        client.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [("clients", "0002_client_first_name_client_last_name_alter_client_name")]
    operations = [migrations.RunPython(split_names, rejoin_names)]
