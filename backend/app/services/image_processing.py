"""
Core image pipeline logic — pure functions, no network/storage/DB calls in
this file, which makes it easy to unit test in isolation (see the tests we
run below) and easy to reuse if we ever move storage providers.

Why we generate FIXED breakpoints instead of resizing on-the-fly per
request: on-the-fly transforms need either (a) a paid CDN transform service
(Supabase's own image transforms require the Pro plan), or (b) a serverless
function per request, which is slower and more complex to run yourself.
Pre-generating a small, fixed set of sizes at upload time is simpler, free
on any hosting tier, and covers real-world screen sizes well enough — the
same tradeoff many small-to-mid e-commerce sites make deliberately.
"""
import base64
from io import BytesIO

from PIL import Image

# The set of widths we generate for every uploaded image. Chosen to cover:
# 200  -> product grid thumbnails on mobile
# 600  -> product grid thumbnails on desktop / small PDP images
# 1200 -> full-size product detail page image
# Add a width here if you introduce a genuinely new layout size later —
# but keep this list short; every extra width is more storage + upload time.
BREAKPOINTS = [200, 600, 1200]

WEBP_QUALITY = 80          # good visual quality, meaningfully smaller than 90+
LQIP_WIDTH = 16             # "Low Quality Image Placeholder" — tiny blurred preview
LQIP_QUALITY = 40
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB — generous for a phone photo, blocks abuse

# Separate from MAX_UPLOAD_BYTES on purpose: a WebP/JPEG can be small in
# FILE SIZE (well under 10MB) while still decoding to an enormous PIXEL
# dimension (e.g. a huge canvas exported at low compression, or corrupted
# dimension metadata) — Pillow calls this a "decompression bomb" risk,
# since decoding it fully can blow up server memory even though the
# uploaded file itself looked small and harmless. 40 megapixels is
# generous for any real product photo (a 4K photo is ~8MP) while still
# blocking pathological files.
MAX_PIXELS = 40_000_000


class InvalidImageError(Exception):
    """Raised when the uploaded bytes aren't a readable image, or exceed
    size limits. Routers catch this and turn it into a clean 400 response."""


def process_image(raw_bytes: bytes) -> dict:
    """
    Takes raw uploaded image bytes, returns:
      {
        "variants": {200: <webp bytes>, 600: <webp bytes>, 1200: <webp bytes>},
        "blur_data_url": "data:image/webp;base64,...",
        "width": <original width>,
        "height": <original height>,
      }
    Never upscales: if the original is smaller than a breakpoint, that
    breakpoint just reuses the original-size resize (no fake pixels
    invented) rather than producing a blurry oversized fake.
    """
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise InvalidImageError(f"Image exceeds the {MAX_UPLOAD_BYTES // (1024*1024)}MB limit")

    try:
        img = Image.open(BytesIO(raw_bytes))
        img_w, img_h = img.size  # reading .size does NOT decode pixel data yet — cheap and safe
        if img_w * img_h > MAX_PIXELS:
            raise InvalidImageError(
                f"Image resolution is too large ({img_w}x{img_h} = {img_w*img_h:,} pixels, "
                f"limit is {MAX_PIXELS:,}). Please resize it before uploading."
            )
        img.load()  # force-read now so a truncated/corrupt file fails here, not later
    except InvalidImageError:
        raise  # let our own, informative error above pass through unchanged
    except Image.DecompressionBombError as e:
        # Belt-and-suspenders: Pillow's own built-in giant-image guard,
        # in case something slips past our explicit MAX_PIXELS check above
        # (e.g. a format where .size lies about the true decoded dimensions).
        raise InvalidImageError(
            "Image resolution is too large to process safely. Please resize it before uploading."
        ) from e
    except Exception as e:
        raise InvalidImageError("File is not a valid, readable image") from e

    # Flatten transparency/palette images onto white — WebP handles alpha
    # fine, but a flat RGB is simpler and avoids surprising black backgrounds
    # on JPEGs converted from PNGs with transparency.
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        img = background
    else:
        img = img.convert("RGB")

    orig_w, orig_h = img.size

    variants: dict[int, bytes] = {}
    for target_w in BREAKPOINTS:
        if target_w >= orig_w:
            resized = img  # don't upscale — use the original for this breakpoint
        else:
            target_h = round(orig_h * (target_w / orig_w))
            resized = img.resize((target_w, target_h), Image.LANCZOS)
        buf = BytesIO()
        resized.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
        variants[target_w] = buf.getvalue()

    # Blur placeholder: a tiny, heavily-compressed version shown instantly
    # while the real image loads, so the layout never shows a blank box.
    lqip_h = round(orig_h * (LQIP_WIDTH / orig_w)) if orig_w >= LQIP_WIDTH else orig_h
    lqip_w = min(LQIP_WIDTH, orig_w)
    lqip = img.resize((lqip_w, max(lqip_h, 1)), Image.LANCZOS)
    lqip_buf = BytesIO()
    lqip.save(lqip_buf, format="WEBP", quality=LQIP_QUALITY)
    blur_data_url = "data:image/webp;base64," + base64.b64encode(lqip_buf.getvalue()).decode()

    return {
        "variants": variants,
        "blur_data_url": blur_data_url,
        "width": orig_w,
        "height": orig_h,
    }