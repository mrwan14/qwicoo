"use client";

import { useEffect } from "react";

/** Last resort when the root layout itself fails. No app providers are available here, so it is plain and bilingual. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f6f3", color: "#1c1b19" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "20vh 16px", display: "grid", gap: 12 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#5f5c55" }}>Try again, or reload the page.</p>
          <p dir="rtl" lang="ar" style={{ margin: 0, color: "#5f5c55" }}>
            حدث خطأ ما. حاول مرة أخرى أو أعد تحميل الصفحة.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: 0, background: "#1c1b19", color: "#fff", fontSize: 14 }}
            >
              Try again · حاول مرة أخرى
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
