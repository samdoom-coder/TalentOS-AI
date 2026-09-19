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

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-hidden tabIndex={-1} className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="card relative w-full max-w-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted" aria-label="Close dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" aria-label="Tabs" className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = tabs.indexOf(t);
            const next = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : tabs[(i - 1 + tabs.length) % tabs.length];
            onChange(next);
          }}
          className={active === t ? "border-b-2 border-primary px-3 py-2 text-sm font-medium" : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// Minimal toast store (no dep). Use `toast("saved")` anywhere client-side.
type ToastMsg = { id: number; text: string };
let toastListeners: ((t: ToastMsg[]) => void)[] = [];
let toastItems: ToastMsg[] = [];
let toastSeq = 1;
export function toast(text: string) {
  toastItems = [...toastItems, { id: toastSeq++, text }].slice(-4);
  for (const fn of toastListeners) fn(toastItems);
  setTimeout(() => {
    toastItems = toastItems.slice(1);
    for (const fn of toastListeners) fn(toastItems);
  }, 3200);
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastMsg[]>([]);
  React.useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((f) => f !== setItems);
    };
  }, []);
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[70] space-y-2">
      {items.map((t) => (
        <div key={t.id} role="status" className="rounded-lg border bg-background px-4 py-2 text-sm shadow-lg">{t.text}</div>
      ))}
    </div>
  );
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadFile(name: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
