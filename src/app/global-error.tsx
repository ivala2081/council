"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground antialiased">
        <div className="flex flex-col items-center gap-6 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Council"
          >
            <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="8" />
            <circle cx="100" cy="100" r="28" fill="currentColor" />
          </svg>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold">
              Something unexpected happened
            </h1>
            <p className="text-sm opacity-60 max-w-sm">
              Council is looking into it. Your data is safe.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-lg bg-current/10 border px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Refresh
            </button>
            <a
              href="/"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
