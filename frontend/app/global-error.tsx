"use client";

/**
 * error.tsx (in this same app/ directory) catches failures in page content,
 * but NOT failures in the root layout.tsx itself — Next.js requires this
 * separate file, global-error.tsx, for that case, and it must render its
 * own <html>/<body> since it replaces the root layout entirely when it
 * fires. In practice our root layout.tsx does no data fetching (see its
 * comments), so this should rarely trigger — it's here as the last line of
 * defense so a failure there NEVER shows Vercel's raw unstyled crash page.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>
            We couldn&apos;t load Infinix right now. Please try again.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>Reference: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24, padding: "8px 20px", fontSize: 14, fontWeight: 500,
              color: "white", background: "#0f766e", border: "none", borderRadius: 4, cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
