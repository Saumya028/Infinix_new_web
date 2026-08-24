"use client";

/**
 * "Ph" = Placeholder-aware image.
 *
 * The marketing sections below reference local files under /public/images
 * that don't exist yet (the user has real photos to upload). Rather than
 * showing a broken-image icon everywhere until every file is in place,
 * this renders a soft branded gradient with a small label — then silently
 * swaps in the real photo the moment it's uploaded and the page reloads.
 * No code changes needed on the user's end, just drop files into /public.
 */
import { useState } from "react";

export default function Ph({
  src,
  alt,
  label,
  className = "",
}: {
  src: string;
  alt: string;
  label?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[linear-gradient(135deg,#F0DCC9_0%,#E8CFA0_50%,#F1E7D8_100%)] ${className}`}
      >
        <div className="px-4 text-center">
          <p className="font-display text-sm italic text-ink/40">
            {label ?? "Image coming soon"}
          </p>
          <p className="mt-1 text-[10px] tracking-widest text-ink/30">{src}</p>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
