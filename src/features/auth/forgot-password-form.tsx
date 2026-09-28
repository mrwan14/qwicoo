"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESET_LINK_SENT_MESSAGE } from "@/lib/auth/password-policy";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const flight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: unknown; detail?: unknown } | null;
      if (response.status === 429) {
        setError("Try again in a minute.");
        return;
      }
      if (response.status === 422) {
        setError(typeof payload?.detail === "string" ? payload.detail : "Enter a valid email address.");
        return;
      }
      if (!response.ok) {
        setError(typeof payload?.detail === "string" ? payload.detail : "Could not send a reset link right now.");
        return;
      }
      setMessage(typeof payload?.message === "string" ? payload.message : RESET_LINK_SENT_MESSAGE);
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
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
        />
      </div>
      {message ? (
        <p role="status" className="rounded-xl border bg-secondary p-4 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
