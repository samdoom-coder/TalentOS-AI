"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, ErrorState } from "@/components/ui/primitives";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const rawNext = useSearchParams().get("next");
  // Only allow same-site relative destinations (no open redirect).
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const res = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message ?? "Sign in failed.");
      return;
    }
    router.push(json.data.role === "candidate" && !json.data.orgId ? "/candidate" : next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
        <span className="font-semibold">TalentOS AI</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Sign in to your hiring workspace.</p>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" {...register("email")} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" className="input" {...register("password")} />
          </div>
          <Button type="submit" disabled={formState.isSubmitting} className="w-full">
            {formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account? <Link href="/signup" className="font-medium text-foreground underline">Create one</Link>
        {" · "}<Link href="/forgot-password" className="underline">Reset password</Link>
      </p>
      <p className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Demo: run <code>npm run db:seed</code> then sign in as <code>ava@acme.ai / password123</code> (recruiter) or <code>candidate@example.com / password123</code>.
      </p>
    </div>
  );
}
