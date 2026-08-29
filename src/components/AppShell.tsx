import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Mail,
  Upload,
  LogOut,
  ShieldCheck,
  HelpCircle,
  UserCog,
  BriefcaseBusiness,
  ClipboardList,
  ChevronsUpDown,
  SlidersHorizontal,
  Database,
} from "lucide-react";
import logo from "@/assets/jlgl-logo.png";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ProgramBadge } from "@/components/brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
const scholarshipNav: NavItem[] = [
  { to: "/help", label: "Help & Guide", icon: HelpCircle },
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applicants", label: "Applicants", icon: Users },
  { to: "/top", label: "Scoring Summary", icon: Trophy },
  { to: "/contact", label: "Contact Center", icon: Mail },
  { to: "/import", label: "Import Data", icon: Upload, adminOnly: true },
];
const grantNav: NavItem[] = [
  { to: "/help", label: "Help & Guide", icon: HelpCircle },
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/grants", label: "Applications", icon: BriefcaseBusiness },
  { to: "/grant-rankings", label: "Rankings", icon: Trophy, adminOnly: true },
  { to: "/grant-rubric", label: "Rubric", icon: SlidersHorizontal, adminOnly: true },
  { to: "/data-source", label: "Application Source", icon: Database, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, programs, selectedProgram, setSelectedProgram, signOut } = useAuth();
  const loc = useLocation();
  const nav2 = useNavigate();
  const nav = selectedProgram?.slug === "business_growth_grant" ? grantNav : scholarshipNav;
  const isProgramAdmin = role === "admin" || selectedProgram?.accessRole === "admin";
  const canUseAdminNav =
    selectedProgram?.slug === "business_growth_grant" ? isProgramAdmin : role === "admin";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border bg-white">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Justice League of Greater Lansing logo" className="h-12 w-auto" />
            <div className="leading-tight">
              <div className="font-display text-sm font-black uppercase text-primary">Justice League</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Review Portal
              </div>
            </div>
          </div>
        </div>
        {programs.length > 0 && (
          <div className="px-3 pt-4">
            <Select
              value={selectedProgram?.slug ?? ""}
              onValueChange={(value) => {
                setSelectedProgram(value as "scholarship" | "business_growth_grant");
                nav2({ to: "/" });
              }}
            >
              <SelectTrigger className="h-auto min-h-11 border-sidebar-border bg-sidebar-accent/70 text-left text-sidebar-foreground focus:ring-sidebar-ring">
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-gold" />
                <SelectValue placeholder="Choose a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.programId} value={program.slug}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            if (n.adminOnly && !canUseAdminNav) return null;
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {isProgramAdmin && selectedProgram && (
            <>
              <Link
                to="/assignments"
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  loc.pathname.startsWith("/assignments")
                    ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <ClipboardList className="h-4 w-4" />
                Reviewer Assignments
              </Link>
              <Link
                to="/users"
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  loc.pathname.startsWith("/users")
                    ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <UserCog className="h-4 w-4" />
                Users & Access
              </Link>
            </>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <div className="text-xs">
            <div className="font-semibold truncate">{user?.email}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-gold">
              <ShieldCheck className="h-3 w-3" />
              <span className="capitalize">{role ?? "—"}</span>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              nav2({ to: "/login" });
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs font-semibold hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src={logo} alt="JLGL" className="h-8 w-auto" />
            <span className="font-display text-sm font-black uppercase text-primary">Justice League Review</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/help" className="inline-flex items-center gap-1 text-xs text-primary">
              <HelpCircle className="h-3.5 w-3.5" /> Help
            </Link>
            <button
              onClick={async () => {
                await signOut();
                nav2({ to: "/login" });
              }}
              className="text-xs text-muted-foreground"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="md:hidden border-b border-border bg-card px-4 py-3 space-y-3">
          {selectedProgram && <ProgramBadge program={selectedProgram.name} />}
          {programs.length > 0 && (
            <Select
              value={selectedProgram?.slug ?? ""}
              onValueChange={(value) => {
                setSelectedProgram(value as "scholarship" | "business_growth_grant");
                nav2({ to: "/" });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.programId} value={program.slug}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {nav
              .filter((item) => !item.adminOnly || canUseAdminNav)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                    loc.pathname === item.to ||
                      (item.to !== "/" && loc.pathname.startsWith(item.to))
                      ? "border-gold bg-gold text-gold-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </div>
        <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
