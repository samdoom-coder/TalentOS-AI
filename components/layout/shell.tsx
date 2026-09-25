"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, Users, UserRoundSearch, ClipboardList,
  Mic, Drama, Presentation, MessagesSquare, BarChart3, Plug, Settings, ShieldCheck, LogOut, Search, Menu, Bell, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, Toaster } from "@/components/ui/primitives";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/talent-pool", label: "Talent Pool", icon: UserRoundSearch },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/interviews", label: "Interviews", icon: Mic },
  { href: "/roleplays", label: "Role Plays", icon: Drama, flag: "ROLEPLAY" as const },
  { href: "/showcases", label: "Showcases", icon: Presentation, flag: "SHOWCASE" as const },
  { href: "/messages", label: "Messages", icon: MessagesSquare },
  { href: "/copilot", label: "Copilot", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 rounded-lg border bg-background p-2 lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        <Menu className="h-4 w-4" />
      </button>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-background transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 px-5 pb-4 pt-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
          <span className="font-semibold tracking-tight">TalentOS AI</span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [palette, setPalette] = useState(false);
  const [unread, setUnread] = useState<number>(0);
  const router = useRouter();
  useEffect(() => {
    let seq = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (typing) return;
      // G then J/C/A/D shortcuts
      if (e.key.toLowerCase() === "g") {
        seq = "g";
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => (seq = ""), 800);
        return;
      }
      if (seq === "g") {
        seq = "";
        const m: Record<string, string> = { j: "/jobs", c: "/candidates", a: "/assessments", i: "/interviews", d: "/dashboard", m: "/messages" };
        const dest = m[e.key.toLowerCase()];
        if (dest) router.push(dest);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  useEffect(() => {
    // Realtime: SSE stream when available, polling fallback.
    let stop = false;
    let es: EventSource | null = null;
    async function poll() {
      try {
        const r = await fetch("/api/v1/notifications").then((x) => x.json());
        if (!stop && r.success) setUnread(r.data.unread ?? 0);
      } catch { /* offline */ }
    }
    try {
      es = new EventSource("/api/v1/events");
      es.onmessage = (e) => {
        try {
          const j = JSON.parse(e.data);
          if (typeof j.unread === "number") setUnread(j.unread);
        } catch { /* heartbeat */ }
      };
      es.onerror = () => { es?.close(); es = null; void poll(); };
    } catch {
      void poll();
    }
    const id = setInterval(poll, 30000);
    return () => { stop = true; clearInterval(id); es?.close(); };
  }, []);
  const COMMANDS = [
    { label: "Create Job", href: "/jobs", hint: "jobs:create" },
    { label: "Search Candidate", href: "/candidates", hint: "G then C" },
    { label: "Create Assessment", href: "/assessments", hint: "G then A" },
    { label: "Schedule Interview", href: "/interviews", hint: "G then I" },
    { label: "Open Analytics", href: "/analytics", hint: "" },
    { label: "Open Settings", href: "/settings", hint: "" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
        <h1 className="text-sm font-medium lg:hidden">{title}</h1>
        <div className="relative ml-auto w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="global-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) router.push(`/candidates?q=${encodeURIComponent(q.trim())}`);
            }}
            onFocus={() => setPalette(true)}
            placeholder="Search candidates…  (Ctrl/⌘ K)"
            className="input !pl-10"
            aria-label="Search candidates"
          />
        </div>
        <Link href="/messages" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative rounded-lg border p-2 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
        </Link>
        {children}
      </div>
      <Dialog open={palette} onClose={() => setPalette(false)} title="Command palette  (Ctrl/⌘ K)">
        <input autoFocus className="input" placeholder="Type a command — try 'interview'" aria-label="Command filter"
          onChange={(e) => setQ(e.target.value)} defaultValue={q} />
        <ul className="mt-2 divide-y rounded-lg border" role="listbox" aria-label="Commands">
          {COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).map((c) => (
            <li key={c.label}>
              <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => { setPalette(false); router.push(c.href); }}>
                <span>{c.label}</span>{c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Shortcuts: G then J jobs · C candidates · A assessments · I interviews · D dashboard · M messages</p>
      </Dialog>
      <Toaster />
    </header>
  );
}
