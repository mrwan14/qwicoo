import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-[length:var(--text-28)] font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That address is not part of this app.</p>
      <Link href="/" className="text-sm underline">
        Back to the start
      </Link>
    </main>
  );
}
