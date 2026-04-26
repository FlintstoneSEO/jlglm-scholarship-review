import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Trophy, Mail, Upload, LogOut, ShieldCheck } from "lucide-react";
import logo from "@/assets/jlgl-logo.png";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applicants", label: "Applicants", icon: Users },
  { to: "/top", label: "Top Applicants", icon: Trophy },
  { to: "/contact", label: "Contact Center", icon: Mail },
  { to: "/import", label: "Import Data", icon: Upload, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const loc = useLocation();
  const nav2 = useNavigate();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border bg-white/95">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Justice League of Greater Lansing logo" className="h-12 w-auto" />
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold text-primary">Scholarship</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Review Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            if (n.adminOnly && role !== "admin") return null;
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-gold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <div className="text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-gold">
              <ShieldCheck className="h-3 w-3" />
              <span className="capitalize">{role ?? "—"}</span>
            </div>
          </div>
          <button
            onClick={async () => { await signOut(); nav2({ to: "/login" }); }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs hover:bg-sidebar-accent"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src={logo} alt="JLGL" className="h-8 w-auto" />
            <span className="font-display font-semibold text-primary">Scholarship Review</span>
          </div>
          <button onClick={async () => { await signOut(); nav2({ to: "/login" }); }} className="text-xs text-muted-foreground">Sign out</button>
        </header>
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
