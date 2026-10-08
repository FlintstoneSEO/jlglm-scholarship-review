import type { Json } from "@/integrations/supabase/types";
export type AllocationEntry = { applicationId: string; pair: number | null; reviewers: string[] };
export type PoolEntry = { id: string; name: string; eligibility: string; exclusion: string | null };
export function allocationEntries(value: Json): AllocationEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid allocation snapshot");
  return value.map((row) => {
    if (
      !row ||
      Array.isArray(row) ||
      typeof row !== "object" ||
      typeof row.applicationId !== "string" ||
      !Array.isArray(row.reviewers) ||
      !row.reviewers.every((id) => typeof id === "string") ||
      !(row.pair === null || row.pair === 1 || row.pair === 2 || row.pair === 3) ||
      (row.pair === null
        ? row.reviewers.length !== 0
        : row.reviewers.length !== 2 || new Set(row.reviewers).size !== 2)
    )
      throw new Error("Invalid allocation entry");
    return {
      applicationId: row.applicationId,
      pair: row.pair,
      reviewers: row.reviewers as string[],
    };
  });
}
export function poolEntries(value: Json): PoolEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid pool snapshot");
  return value.map((row) => {
    if (
      !row ||
      Array.isArray(row) ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.eligibility !== "string" ||
      !(row.exclusion === null || typeof row.exclusion === "string")
    )
      throw new Error("Invalid pool entry");
    return { id: row.id, name: row.name, eligibility: row.eligibility, exclusion: row.exclusion };
  });
}
export function validPairRoster(ids: string[], members: string[]) {
  return (
    ids.length === 6 && new Set(ids).size === 6 && ids.every((id) => !!id && members.includes(id))
  );
}
export function allocationSummary(entries: AllocationEntry[]) {
  return {
    pool: entries.length,
    covered: entries.filter((e) => e.pair !== null).length,
    unallocated: entries.filter((e) => e.pair === null).length,
    pairs: [1, 2, 3].map((pair) => entries.filter((e) => e.pair === pair).length),
  };
}

export type GroupSnapshot = { id: string; name: string; revision: number; members: string[] };
export function groupSnapshots(value: Json | null): GroupSnapshot[] {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length !== 3) throw new Error("Invalid group snapshot");
  return value.map((row) => {
    if (
      !row ||
      Array.isArray(row) ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.revision !== "number" ||
      !Number.isInteger(row.revision) ||
      row.revision < 1 ||
      !Array.isArray(row.members) ||
      row.members.length !== 2 ||
      !row.members.every((id) => typeof id === "string") ||
      new Set(row.members).size !== 2
    )
      throw new Error("Invalid group snapshot");
    return { id: row.id, name: row.name, revision: row.revision, members: row.members as string[] };
  });
}
