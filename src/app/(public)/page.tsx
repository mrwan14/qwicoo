import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold">Qwicoo</p>
      <h1 className="text-[length:var(--text-40)] leading-none font-semibold">
        Orders for the floor, the kitchen, and the table.
      </h1>
      <p className="text-base text-muted-foreground">
        Staff sign in to run the branch. Guests will order from a table QR in the next phase.
      </p>
      <Link
        href="/login"
        className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Staff sign in
      </Link>
    </main>
  );
}
