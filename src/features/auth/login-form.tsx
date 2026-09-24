"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SEEDS = [
  { label: "Super admin", email: "admin@gourmet.com", password: "Admin123!" },
  { label: "Branch admin", email: "branchadmin@gourmet.com", password: "Admin123!" },
  { label: "Cashier", email: "cashier@gourmet.com", password: "Admin123!" },
  { label: "Brand admin", email: "admin.alezz@mezban.com", password: "Password123!" },
] as const;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const flight = useRef(false);
  const attempt = useRef(0);

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const waitMs = Math.max(0, lockUntil - now);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || waitMs > 0) return;
    flight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.status === 429) {
        const delay = Math.min(1000 * 2 ** attempt.current, 16_000);
        attempt.current += 1;
        setLockUntil(Date.now() + delay);
        setError("Too many sign-in attempts. The button stays disabled until the wait ends.");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        setError(typeof payload?.detail === "string" ? payload.detail : "Sign-in failed.");
        return;
      }
      attempt.current = 0;
      window.location.assign("/app");
    } catch {
      setError("The app could not reach the sign-in service.");
    } finally {
      flight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {waitMs > 0 ? ` Try again in ${Math.ceil(waitMs / 1000)}s.` : null}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending || waitMs > 0}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Local seed accounts</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SEEDS.map((seed) => (
            <Button
              key={seed.email}
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setEmail(seed.email);
                setPassword(seed.password);
              }}
            >
              {seed.label}
            </Button>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
