/**
 * next/image normally expects to request ANY arbitrary width from an image
 * optimization service (Vercel's built-in one, or a paid CDN). We don't
 * have that — our backend pre-generates exactly 3 fixed sizes per image
 * (see backend/app/services/image_processing.py: BREAKPOINTS = [200, 600,
 * 1200]). This custom loader is the bridge: whatever width next/image asks
 * for, we snap it UP to the nearest size we actually generated, and build
 * the URL by appending "-{width}.webp" to the base key next/image was
 * given as `src`.
 *
 * This must stay in sync with BREAKPOINTS in the backend. If you change
 * one, change the other.
 */
const AVAILABLE_WIDTHS = [200, 600, 1200];

export default function infinixImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const snappedWidth =
    AVAILABLE_WIDTHS.find((w) => w >= width) ?? AVAILABLE_WIDTHS[AVAILABLE_WIDTHS.length - 1];
  return `${src}-${snappedWidth}.webp`;
}
