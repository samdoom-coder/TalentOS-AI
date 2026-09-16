"use client";

import { useEffect, useState } from "react";

export interface Me {
  id: string;
  email: string;
  name: string;
  orgId?: string;
  role?: string;
  organizations: { id: string; name: string; slug: string; role: string }[];
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then(async (r) => {
        const j = await r.json();
        if (!j.success) throw new Error(j.error?.message ?? "Not signed in");
        setMe(j.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading, error, orgId: me?.orgId ?? me?.organizations[0]?.id };
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, error, reload };
}
