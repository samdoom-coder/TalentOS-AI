"use client";

import { useState } from "react";
import { useMe } from "@/lib/client";
import { Card, Button, Skeleton } from "@/components/ui/primitives";

export default function CandidateProfilePage() {
  const { me, loading } = useMe();
  const [profile, setProfile] = useState({ title: "", location: "", skills: "", portfolioUrl: "", linkedinUrl: "", githubUrl: "", availability: "", discoverable: false });
  const [saved, setSaved] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-40" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {me?.email}. Only what you share is visible to recruiters.</p>
      <Card className="mt-4">
        <div className="grid gap-3">
          <div><label className="label" htmlFor="title">Professional title</label><input id="title" className="input" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></div>
          <div><label className="label" htmlFor="loc">Location</label><input id="loc" className="input" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></div>
          <div><label className="label" htmlFor="skills">Skills (comma separated)</label><input id="skills" className="input" value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="port">Portfolio</label><input id="port" className="input" value={profile.portfolioUrl} onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })} /></div>
            <div><label className="label" htmlFor="li">LinkedIn</label><input id="li" className="input" value={profile.linkedinUrl} onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })} /></div>
            <div><label className="label" htmlFor="gh">GitHub</label><input id="gh" className="input" value={profile.githubUrl} onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profile.discoverable} onChange={(e) => setProfile({ ...profile, discoverable: e.target.checked })} />
            Allow recruiters to discover my public profile (opt-in talent discovery)
          </label>
          <Button onClick={() => setSaved("Profile saved locally for this demo — full sync ships with the talent-profile API.")}>Save profile</Button>
          {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
        </div>
      </Card>
    </div>
  );
}
