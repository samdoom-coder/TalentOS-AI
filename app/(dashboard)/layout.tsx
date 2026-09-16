import { Sidebar, Topbar } from "@/components/layout/shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-60">
        <Topbar title="TalentOS AI" />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
