"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, PageHeader, ScoreBar, Button, toCsv, downloadFile, toast } from "@/components/ui/primitives";

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}

function CompareView() {
  const sp = useSearchParams();
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    Promise.all(ids.map((id) => fetch(`/api/v1/candidates/${id}`).then((r) => r.json()))).then((rs) =>
      setItems(rs.filter((r) => r.success).map((r) => r.data))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get("ids")]);

  const allReqs = [...new Set(items.flatMap((c) => (c.evidence ?? []).map((e: any) => e.requirement)))];

  function exportCsv() {
    const rows = allReqs.map((r) => {
      const row: Record<string, unknown> = { requirement: r };
      for (const c of items) {
        const e = (c.evidence ?? []).find((x: any) => x.requirement === r);
        row[c.name] = e ? `${e.score} (${e.confidence}) ${(e.evidence ?? "").slice(0, 120)}` : "—";
      }
      return row;
    });
    downloadFile("comparison.csv", toCsv(rows));
    toast("Comparison exported");
  }

  return (
    <div>
      <PageHeader title="Compare candidates" subtitle="Evidence side-by-side — uncertainty is shown, not hidden behind one number." action={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>} />
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((c) => (
          <Card key={c.id}>
            <Link href={`/candidates/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
            <p className="text-sm text-muted-foreground">{c.title ?? c.email}</p>
            <p className="mt-2 text-sm">Match: <span className="font-semibold">{c.applications?.[0]?.matchScore ?? "—"}</span></p>
            {c.applications?.[0]?.matchScore != null && <ScoreBar score={c.applications[0].matchScore} className="mt-1" />}
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Requirement</th>{items.map((c) => <th key={c.id} className="py-2">{c.name}</th>)}</tr></thead>
            <tbody>
              {allReqs.map((r) => (
                <tr key={r} className="border-b last:border-0 align-top">
                  <td className="py-2 font-medium">{r}</td>
                  {items.map((c) => {
                    const e = (c.evidence ?? []).find((x: any) => x.requirement === r);
                    return <td key={c.id} className="py-2 pr-4">{e ? <><span className="font-semibold">{e.score}</span> <span className="text-xs text-muted-foreground">({e.confidence})</span><p className="text-xs text-muted-foreground">“{(e.evidence ?? "").slice(0, 140)}”</p></> : <span className="text-muted-foreground">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
