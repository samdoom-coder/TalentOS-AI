"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/v1/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setDone(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
        <span className="font-semibold">TalentOS AI</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">We&apos;ll email you a reset link if an account exists.</p>
      <Card>
        {done ? (
          <p className="text-sm">Check your inbox for a reset link (dev: see server logs for the token).</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="w-full">Send reset link</Button>
          </form>
        )}
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline">Back to sign in</Link>
      </p>
    </div>
  );
}
