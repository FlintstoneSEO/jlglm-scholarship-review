import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  const [role, setRole] = useState<AppRole | null>(null);
  const [programs, setPrograms] = useState<ProgramAccess[]>([]);
  const [selectedProgram, setSelectedProgramState] = useState<ProgramAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadAuthorization(s.user.id), 0);
      } else {
        setRole(null);
        setPrograms([]);
        setSelectedProgramState(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadAuthorization(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAuthorization(uid: string) {
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
    const { data: programRows } = ids.length
      ? await supabase.from("programs").select("id, slug, name, description").in("id", ids)
      : { data: [] };
    const byId = new Map((programRows ?? []).map((program) => [program.id, program]));
    const nextPrograms = (accessRows ?? [])
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
