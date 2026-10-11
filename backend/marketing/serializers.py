from rest_framework import serializers

from urllib.parse import urlparse

from PIL import Image

from .models import EBlast, MarketingTemplate

# ----------------------------------------------------------------------------
# The actual "send this email to my client list" logic lives in
# marketing/views.py (on the SendEBlastView), not here — this file is
# just for turning an EBlast row into/from JSON. Keeping the sending
# side-effect out of the serializer keeps this file simple and makes the
# "where does sending actually happen" question have one obvious answer.
# ----------------------------------------------------------------------------


MAX_TEMPLATE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = ("PNG", "JPEG", "WEBP")


def absolute_url(request, file_field):
    if not file_field:
        return None
    url = file_field.url
    return request.build_absolute_uri(url) if request is not None else url


class MarketingTemplateSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = MarketingTemplate
        fields = ["id", "name", "image", "image_url", "canva_link", "created_at"]
        read_only_fields = ["id", "image_url", "created_at"]
        extra_kwargs = {
            "image": {
                "error_messages": {
                    "invalid_image": "Upload a PNG, JPG, or WebP image. In Canva, choose Download, then PNG or JPG.",
                    "required": "Choose the image you downloaded from Canva.",
                }
            }
        }

    def get_image_url(self, template):
        return absolute_url(self.context.get("request"), template.image)

    def validate_image(self, image):
        if image.size > MAX_TEMPLATE_BYTES:
            raise serializers.ValidationError("That image is over 5 MB. Export it at a smaller size from Canva.")
        # Checks what the file actually is, not the label the browser sent with it.
        try:
            with Image.open(image) as picture:
                file_format = picture.format
        except Exception as exc:
            raise serializers.ValidationError("Upload a PNG, JPG, or WebP image. In Canva, choose Download, then PNG or JPG.") from exc
        image.seek(0)
        if file_format not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError("Upload a PNG, JPG, or WebP image. In Canva, choose Download, then PNG or JPG.")
        return image

    def validate_canva_link(self, value):
        if not value:
            return value
        parts = urlparse(value)
        if parts.scheme != "https" or not parts.netloc.endswith("canva.com"):
            raise serializers.ValidationError("Paste the full link to your design from Canva. It starts with https://www.canva.com/")
        return value


class EBlastSerializer(serializers.ModelSerializer):
    template = serializers.PrimaryKeyRelatedField(queryset=MarketingTemplate.objects.all(), allow_null=True, required=False)
    template_image = serializers.SerializerMethodField()

    def get_template_image(self, eblast):
        return absolute_url(self.context.get("request"), eblast.template.image) if eblast.template_id else None

    def validate_template(self, template):
        # Only this business's own templates can be used.
        if template is None:
            return template
        account = self.context["request"].user
        if not MarketingTemplate.objects.for_account(account).filter(pk=template.pk).exists():
            raise serializers.ValidationError("That template isn't on your account.")
        return template

    class Meta:
        model = EBlast
        fields = [
            "id",
            "subject",
            "body",
            "template",
            "template_image",
            "template_key",
            "sent_at",
            "recipient_count",
            "created_at",
            "updated_at",
        ]
        # recipient_count and sent_at are only ever set by the send
        # action, never directly edited by the frontend.
        read_only_fields = ["id", "sent_at", "recipient_count", "created_at", "updated_at"]

    def validate(self, attrs):
        # Once an e-blast has actually been sent, it's locked — editing
        # the subject/body afterward would be misleading (the email that
        # already landed in someone's inbox can't un-send itself to
        # match). self.instance is None on create, so this check only
        # matters for updates (PATCH) to an existing row.
        if self.instance is not None and self.instance.sent_at is not None:
            raise serializers.ValidationError("This e-blast has already been sent and can't be edited.")
        return attrs
