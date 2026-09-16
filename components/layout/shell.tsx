"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, Users, UserRoundSearch, ClipboardList,
  Mic, Drama, Presentation, MessagesSquare, BarChart3, Plug, Settings, ShieldCheck, LogOut, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        <Search className="h-4 w-4" />
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
          {NAV.filter((n) => !n.flag || (n.flag === "ROLEPLAY" || n.flag === "SHOWCASE")).map((item) => {
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
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
            placeholder="Search candidates…  (Ctrl/⌘ K)"
            className="input pl-9"
            aria-label="Search candidates"
          />
        </div>
        {children}
      </div>
    </header>
  );
}
