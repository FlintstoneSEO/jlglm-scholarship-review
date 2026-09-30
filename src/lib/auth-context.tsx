import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readAccountSetupCompleted } from "./account-setup";

export type AppRole = "admin" | "reviewer" | "viewer";
export type ProgramSlug = "scholarship" | "business_growth_grant";
export type ProgramAccessRole = "admin" | "reviewer" | "viewer";
export type ProgramAccess = {
  id: string;
  programId: string;
  slug: ProgramSlug;
  name: string;
  description: string | null;
  accessRole: ProgramAccessRole;
};

interface AuthCtx {
  user: User | null;
  session: Session | null;
  accountSetupCompleted: boolean | null;
  refreshAccountSetup: () => Promise<void>;
  role: AppRole | null;
  programs: ProgramAccess[];
  selectedProgram: ProgramAccess | null;
  setSelectedProgram: (slug: ProgramSlug) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  accountSetupCompleted: null,
  refreshAccountSetup: async () => {},
  role: null,
  programs: [],
  selectedProgram: null,
  setSelectedProgram: () => {},
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accountSetupCompleted, setAccountSetupCompleted] = useState<boolean | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [programs, setPrograms] = useState<ProgramAccess[]>([]);
  const [selectedProgram, setSelectedProgramState] = useState<ProgramAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let version = 0;
    const applySession = (s: Session | null) => {
      const current = ++version;
      setSession(s);
      setUser(s?.user ?? null);
      setAccountSetupCompleted(null);
      setRole(null);
      setPrograms([]);
      setSelectedProgramState(null);
      setLoading(!!s);
      if (s?.user) {
        // Run outside the synchronous auth callback; Supabase API calls there can deadlock.
        void Promise.resolve().then(async () => {
          try {
            const setup = await readAccountSetupCompleted(s.user.id);
            if (!active || current !== version) return;
            setAccountSetupCompleted(setup);
            await loadAuthorization(s.user.id, () => active && current === version);
          } catch (error) {
            console.error("Could not load account setup state", error);
            if (active && current === version) setLoading(false);
          }
        });
      } else {
        setRole(null);
        setPrograms([]);
        setSelectedProgramState(null);
        setLoading(false);
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== "TOKEN_REFRESHED" && event !== "USER_UPDATED") applySession(s);
      else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && version === 0) applySession(data.session);
    });
    return () => {
      active = false;
      version++;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadAuthorization(uid: string, isCurrent: () => boolean) {
    if (!isCurrent()) return;
    setLoading(true);
    const [{ data: roleRows }, { data: accessRows }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_program_access").select("id, program_id, access_role").eq("user_id", uid),
    ]);
    const roleRank: Record<AppRole, number> = { admin: 1, reviewer: 2, viewer: 3 };
    const nextRole = ((roleRows ?? [])
      .map((r) => r.role as AppRole)
      .sort((a, b) => roleRank[a] - roleRank[b])[0] ?? "viewer") as AppRole;
    const ids = (accessRows ?? []).map((row) => row.program_id);
    const { data: programRows } =
      nextRole === "admin"
        ? await supabase.from("programs").select("id, slug, name, description").eq("active", true)
        : ids.length
          ? await supabase.from("programs").select("id, slug, name, description").in("id", ids)
          : { data: [] };
    const byId = new Map((programRows ?? []).map((program) => [program.id, program]));
    const nextPrograms = (
      nextRole === "admin"
        ? (programRows ?? []).map((program) => ({
            id: `global:${program.id}`,
            program_id: program.id,
            access_role: "admin" as const,
          }))
        : (accessRows ?? [])
    )
      .flatMap((access) => {
        const program = byId.get(access.program_id);
        if (!program) return [];
        return [
          {
            id: access.id,
            programId: access.program_id,
            slug: program.slug as ProgramSlug,
            name: program.name,
            description: program.description,
            accessRole: access.access_role as ProgramAccessRole,
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("jlgl.selectedProgram") : null;
    const initial =
      nextPrograms.length === 1
        ? nextPrograms[0]
        : (nextPrograms.find((program) => program.slug === stored) ?? null);
    if (!isCurrent()) return;
    setRole(nextRole);
    setPrograms(nextPrograms);
    setSelectedProgramState(initial);
    setLoading(false);
  }

  function setSelectedProgram(slug: ProgramSlug) {
    const program = programs.find((item) => item.slug === slug) ?? null;
    setSelectedProgramState(program);
    if (program && typeof window !== "undefined")
      localStorage.setItem("jlgl.selectedProgram", program.slug);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        accountSetupCompleted,
        refreshAccountSetup: async () => {
          if (!user) return;
          setLoading(true);
          try {
            setAccountSetupCompleted(await readAccountSetupCompleted(user.id));
          } finally {
            setLoading(false);
          }
        },
        role,
        programs,
        selectedProgram,
        setSelectedProgram,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
