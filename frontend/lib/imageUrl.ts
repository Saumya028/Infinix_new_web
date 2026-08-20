/**
 * next/image (via lib/imageLoader.ts's custom loader) knows how to turn a
 * processed image's base storage key into a real, loadable URL by
 * appending "-{width}.webp" — but that only happens automatically when
 * you render through the <Image> component. Anywhere we use a plain
 * <img> tag instead (small fixed-size thumbnails: cart line items, admin
 * panel previews, the guest cart persisted to localStorage before
 * login), we have to build that same URL ourselves. This is the one
 * place that does it, so every caller stays in sync if the generated
 * sizes ever change.
 *
 * Must match backend/app/services/image_processing.py's BREAKPOINTS.
 */
const AVAILABLE_WIDTHS = [200, 600, 1200] as const;

export function toThumbnailUrl(
  baseUrlOrKey: string,
  isProcessed: boolean,
  width: (typeof AVAILABLE_WIDTHS)[number] = 200,
): string {
  // Legacy manually-pasted image (Step 4's "paste any URL" admin route)
  // has no generated sizes behind it — it's already a complete URL.
  if (!isProcessed) return baseUrlOrKey;
  return `${baseUrlOrKey}-${width}.webp`;
}
