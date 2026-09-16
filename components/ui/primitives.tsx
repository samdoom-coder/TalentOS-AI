import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "destructive" }) {
  const styles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted",
    destructive: "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50",
  } as const;
  return <button className={cn(styles[variant], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...props} />;
}

export function Badge({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "green" | "amber" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return <span className={cn("badge", tones[tone], className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Score ${pct} percent`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
