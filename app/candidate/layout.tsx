import Link from "next/link";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/candidate" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
            <span className="font-semibold">TalentOS AI</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground" aria-label="Candidate">
            <Link href="/candidate" className="hover:text-foreground">My applications</Link>
            <Link href="/candidate/profile" className="hover:text-foreground">Profile</Link>
            <Link href="/careers" className="hover:text-foreground">Browse jobs</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
