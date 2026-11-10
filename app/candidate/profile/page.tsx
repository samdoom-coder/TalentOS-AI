"use client";

import { useEffect, useState } from "react";
import { useApi, api } from "@/lib/client";
import { Card, Button, Skeleton, ErrorState, toast, downloadFile } from "@/components/ui/primitives";

interface Portal {
  user: { id: string; email: string; name: string };
  profile: any;
}

const EMPTY = {
  title: "",
  location: "",
  phone: "",
  summary: "",
  experienceYrs: "",
  skills: "",
  portfolioUrl: "",
  linkedinUrl: "",
  githubUrl: "",
  websiteUrl: "",
  availability: "",
  discoverable: false,
};

export default function CandidateProfilePage() {
  const { data, loading, error, reload } = useApi<Portal>("/api/v1/candidate/me");
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setForm({
      title: p.title ?? "",
      location: p.location ?? "",
      phone: p.phone ?? "",
      summary: p.summary ?? "",
      experienceYrs: p.experienceYrs != null ? String(p.experienceYrs) : "",
      skills: (p.skills ?? []).map((s: any) => s.skill).join(", "),
      portfolioUrl: p.portfolioUrl ?? "",
      linkedinUrl: p.linkedinUrl ?? "",
      githubUrl: p.githubUrl ?? "",
      websiteUrl: p.websiteUrl ?? "",
      availability: p.availability ?? "",
      discoverable: Boolean(p.discoverable),
    });
  }, [data]);

  if (loading) return <Skeleton className="h-40" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      await api(`/api/v1/candidate/me`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          experienceYrs: form.experienceYrs === "" ? null : Number(form.experienceYrs),
        }),
      });
      setSaved("Profile saved. Recruiters you apply to will see these details.");
      toast("Profile saved");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function exportMine() {
    try {
      const r = await fetch(`/api/v1/privacy?email=${encodeURIComponent(data?.user.email ?? "")}`).then((x) => x.json());
      if (!r.success) throw new Error(r.error?.message ?? "Export failed");
      downloadFile("my-data.json", JSON.stringify(r.data, null, 2), "application/json");
      toast("Exported your data");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function deleteMine() {
    if (window.prompt("Type DELETE to erase your candidate data and account:") !== "DELETE") return;
    try {
      await api(`/api/v1/privacy`, { method: "DELETE", body: JSON.stringify({ confirm: "DELETE" }) });
      toast("Account deleted — signing out");
      await fetch("/api/v1/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {data?.user.email}. Only what you share is visible to recruiters.</p>
      <Card className="mt-4">
        <div className="grid gap-3">
          <div><label className="label" htmlFor="title">Professional title</label><input id="title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="loc">Location</label><input id="loc" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><label className="label" htmlFor="summary">Professional summary</label><textarea id="summary" className="input h-auto" rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="skills">Skills (comma separated)</label><input id="skills" className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
            <div><label className="label" htmlFor="years">Years of experience</label><input id="years" type="number" min={0} max={80} className="input" value={form.experienceYrs} onChange={(e) => setForm({ ...form, experienceYrs: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="port">Portfolio</label><input id="port" className="input" value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} /></div>
            <div><label className="label" htmlFor="li">LinkedIn</label><input id="li" className="input" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} /></div>
            <div><label className="label" htmlFor="gh">GitHub</label><input id="gh" className="input" value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} /></div>
            <div><label className="label" htmlFor="web">Website</label><input id="web" className="input" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} /></div>
          </div>
          <div><label className="label" htmlFor="avail">Availability</label><input id="avail" className="input" placeholder="e.g. 2 weeks' notice, open to remote" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.discoverable} onChange={(e) => setForm({ ...form, discoverable: e.target.checked })} />
            Allow recruiters to discover my public profile (opt-in talent discovery)
          </label>
          <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save profile"}</Button>
          {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
        </div>
      </Card>
      <Card className="mt-4">
        <p className="font-semibold">Privacy</p>
        <p className="mt-1 text-sm text-muted-foreground">Export everything linked to your account, or erase it (GDPR-style).</p>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={exportMine}>Export my data (JSON)</Button>
          <Button variant="destructive" onClick={deleteMine}>Delete my account</Button>
        </div>
      </Card>
    </div>
  );
}
