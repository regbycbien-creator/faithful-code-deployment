import { supabase } from "@/integrations/supabase/client";

export type VersionInfo = { id: string; note: string; author_label: string; created_at: string };

export async function latestPublicData(): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("public_versions")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function versionData(id: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("public_versions")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function listVersions(): Promise<VersionInfo[]> {
  const { data, error } = await supabase
    .from("public_versions")
    .select("id, note, author_label, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function publishVersion(bookJson: string, note: string): Promise<void> {
  const { error } = await supabase
    .from("public_versions")
    .insert({ data: JSON.parse(bookJson), note });
  if (error) throw error;
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
