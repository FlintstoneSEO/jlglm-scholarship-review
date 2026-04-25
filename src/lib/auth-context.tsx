import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "reviewer" | "viewer";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, role: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRole(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRole(uid: string) {
    const { data } = await supabase.rpc("get_user_role", { _user_id: uid });
    setRole((data as AppRole) ?? "viewer");
  }

  return (
    <Ctx.Provider value={{ user, session, role, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
