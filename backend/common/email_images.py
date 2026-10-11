import os
from email.mime.image import MIMEImage

# ----------------------------------------------------------------------------
# Puts an image inside the email itself. The HTML points at the attached copy
# ("cid:..."), so the picture shows up without needing a public web address for
# it. That matters: a logo or design saved on our own server might not be
# reachable from the outside, and email apps block pictures they can't check.
# ----------------------------------------------------------------------------

SUBTYPES = {".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp"}


def attach_inline_image(message, image_field, content_id):
    """Attaches the image to the email. Returns the cid: address the HTML should use for it."""
    name = os.path.basename(image_field.name)
    subtype = SUBTYPES.get(os.path.splitext(name)[1].lower(), "png")
    image_field.open("rb")
    try:
        data = image_field.read()
    finally:
        image_field.close()
    part = MIMEImage(data, _subtype=subtype)
    part.add_header("Content-ID", f"<{content_id}>")
    part.add_header("Content-Disposition", "inline", filename=name)
    message.attach(part)
    return f"cid:{content_id}"
