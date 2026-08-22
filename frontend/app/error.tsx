"use client";

/**
 * Next.js App Router convention: a file named error.tsx in app/ becomes
 * the error boundary for everything under it. If a Server Component page
 * throws and nothing catches it locally (unlike the try/catch we added to
 * app/page.tsx and app/products/page.tsx), THIS renders instead of the
 * generic "Application error: a server-side exception has occurred /
 * Digest: ..." screen you saw — same underlying failure, but with an
 * actual message and a retry button instead of a dead end.
 *
 * Must be a Client Component (Next.js requirement for error boundaries).
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
    // Full error (including stack) lands in the server/Vercel function
    // logs via this — the browser only ever sees the message below, never
    // internals, but whoever's debugging can search logs for the digest.
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-500">
        We couldn&apos;t load this page. This is usually temporary — please try again.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-gray-400">Reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Try again
      </button>
    </div>
  );
}
