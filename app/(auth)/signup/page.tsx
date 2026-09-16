"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, ErrorState } from "@/components/ui/primitives";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["recruiter", "candidate"]),
  organizationName: z.string().optional(),
});

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "recruiter" },
  });
  const role = watch("role");

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const res = await fetch("/api/v1/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message ?? "Sign up failed.");
      return;
    }
    router.push(json.data.role === "candidate" ? "/candidate" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
        <span className="font-semibold">TalentOS AI</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Start hiring with AI-powered evaluation + human decisions.</p>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="label" htmlFor="role">I am a…</label>
            <select id="role" className="input" {...register("role")}>
              <option value="recruiter">Recruiter / hiring team</option>
              <option value="candidate">Candidate looking for work</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" autoComplete="name" {...register("name")} />
          </div>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" type="email" className="input" autoComplete="email" {...register("email")} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password (min 8 chars)</label>
            <input id="password" type="password" className="input" autoComplete="new-password" {...register("password")} />
          </div>
          {role === "recruiter" && (
            <div>
              <label className="label" htmlFor="organizationName">Organization name</label>
              <input id="organizationName" className="input" placeholder="Acme Inc." {...register("organizationName")} />
              <p className="mt-1 text-xs text-muted-foreground">We&apos;ll create your workspace, owner account, and default ATS pipeline.</p>
            </div>
          )}
          <Button type="submit" disabled={formState.isSubmitting} className="w-full">
            {formState.isSubmitting ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Have an account? <Link href="/login" className="font-medium text-foreground underline">Sign in</Link>
      </p>
    </div>
  );
}
