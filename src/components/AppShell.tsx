import { useGrantConflictCount } from "@/lib/use-grant-conflict-count";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  FlaskConical,
  BriefcaseBusiness,
  ClipboardList,
  ChevronsUpDown,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import logo from "@/assets/jlgl-logo.png";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mobileAdminDestinations } from "@/lib/navigation-policy";

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
  { to: "/grant-import", label: "Import Applications", icon: Upload, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, programs, selectedProgram, setSelectedProgram, signOut } = useAuth();
  const loc = useLocation();
  const nav2 = useNavigate();
  const nav = selectedProgram?.slug === "business_growth_grant" ? grantNav : scholarshipNav;
  const isProgramAdmin = role === "admin" || selectedProgram?.accessRole === "admin";
  const canUseAdminNav =
    selectedProgram?.slug === "business_growth_grant" ? isProgramAdmin : role === "admin";
  const isGrant = selectedProgram?.slug === "business_growth_grant";
  const conflicts = useGrantConflictCount(selectedProgram?.programId, isGrant && isProgramAdmin);
  const assignmentLabel = isGrant ? "Review Distribution" : "Reviewer Assignments";
  const assignmentAttention = conflicts.data
    ? ` ? ${conflicts.data} conflicts require attention`
    : conflicts.isError
      ? " ? attention status unavailable"
      : "";
  const isGrantDetail = loc.pathname.startsWith("/grants/");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [programMenuOpen, setProgramMenuOpen] = useState(false);
  const sidebarExpanded = !sidebarCollapsed || sidebarPeek || programMenuOpen;
  const desktopLinkClass =
    "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

  return (
    <div className="portal-shell flex min-h-screen bg-background md:h-dvh md:min-h-0 md:overflow-hidden">
      <aside
        aria-label="Portal sidebar"
        onMouseEnter={() => sidebarCollapsed && setSidebarPeek(true)}
        onMouseLeave={() => setSidebarPeek(false)}
        onFocusCapture={() => sidebarCollapsed && setSidebarPeek(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSidebarPeek(false);
        }}
        className={cn(
          "relative z-30 hidden shrink-0 md:block md:h-dvh",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150",
            sidebarExpanded ? "w-64" : "w-20",
            sidebarCollapsed && sidebarPeek && "shadow-xl",
          )}
        >
          <div
            className={cn(
              "border-b border-sidebar-border bg-white py-3",
              sidebarExpanded ? "px-4" : "px-2",
            )}
          >
            <div className={cn("flex items-center gap-2", !sidebarExpanded && "flex-col gap-1")}>
              <img
                src={logo}
                alt="Justice League of Greater Lansing logo"
                className="h-10 w-auto shrink-0"
              />
              <div className={cn("min-w-0 flex-1 leading-tight", !sidebarExpanded && "hidden")}>
                <div className="font-display text-sm font-black uppercase text-primary">
                  Justice League
                </div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Review Portal
                </div>
              </div>
              <button
                type="button"
                aria-label={
                  sidebarCollapsed ? "Expand portal navigation" : "Collapse portal navigation"
                }
                aria-expanded={sidebarExpanded}
                title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                onClick={() => {
                  setSidebarCollapsed((current) => !current);
                  setSidebarPeek(false);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {programs.length > 0 && (
            <div
              className={cn(
                "border-b border-sidebar-border py-3",
                sidebarExpanded ? "px-3" : "px-2",
              )}
            >
              <p
                className={cn(
                  "mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/70",
                  !sidebarExpanded && "sr-only",
                )}
              >
                Current program
              </p>
              <Select
                onOpenChange={setProgramMenuOpen}
                value={selectedProgram?.slug ?? ""}
                onValueChange={(value) => {
                  setSelectedProgram(value as "scholarship" | "business_growth_grant");
                  nav2({ to: "/" });
                }}
              >
                <SelectTrigger
                  aria-label="Current program"
                  className={cn(
                    "h-auto min-h-11 border-sidebar-border bg-sidebar-accent text-left font-semibold text-sidebar-foreground focus:ring-sidebar-ring",
                    !sidebarExpanded && "justify-center px-1 [&>svg:last-child]:hidden",
                  )}
                >
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-gold" />
                  <span className={cn(!sidebarExpanded && "sr-only")}>
                    <SelectValue placeholder="Choose a program" />
                  </span>
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
          <nav
            aria-label="Portal navigation"
            className={cn(
              "min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2",
              sidebarExpanded ? "px-3" : "px-2",
            )}
          >
            {nav.map((n) => {
              if (n.adminOnly && !canUseAdminNav) return null;
              const active =
                loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-label={n.label}
                  title={!sidebarExpanded ? n.label : undefined}
                  className={cn(
                    desktopLinkClass,
                    !sidebarExpanded && "justify-center px-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {sidebarExpanded && n.label}
                </Link>
              );
            })}
            {isProgramAdmin && selectedProgram && (
              <>
                <Link
                  to="/testing"
                  aria-label="Testing"
                  title={!sidebarExpanded ? "Testing" : undefined}
                  className={cn(
                    desktopLinkClass,
                    !sidebarExpanded && "justify-center px-2",
                    loc.pathname === "/testing"
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                  )}
                >
                  <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {sidebarExpanded && "Testing"}
                </Link>
                <Link
                  to="/assignments"
                  aria-label={assignmentLabel + assignmentAttention}
                  title={!sidebarExpanded ? assignmentLabel + assignmentAttention : undefined}
                  className={cn(
                    desktopLinkClass,
                    !sidebarExpanded && "justify-center px-2",
                    loc.pathname.startsWith("/assignments")
                      ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {sidebarExpanded && (
                    <span>
                      {assignmentLabel}
                      {assignmentAttention}
                    </span>
                  )}
                </Link>
                <Link
                  to="/users"
                  aria-label="Users & Access"
                  title={!sidebarExpanded ? "Users & Access" : undefined}
                  className={cn(
                    desktopLinkClass,
                    !sidebarExpanded && "justify-center px-2",
                    loc.pathname.startsWith("/users")
                      ? "bg-sidebar-accent text-sidebar-primary before:absolute before:left-0 before:h-5 before:w-1 before:rounded-r before:bg-sidebar-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <UserCog className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {sidebarExpanded && "Users & Access"}
                </Link>
              </>
            )}
          </nav>
          <div
            className={cn(
              "shrink-0 space-y-2 border-t border-sidebar-border py-3",
              sidebarExpanded ? "px-4" : "px-2",
            )}
          >
            <div className={cn("text-xs", !sidebarExpanded && "sr-only")}>
              <div className="font-semibold truncate">{user?.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-gold">
                <ShieldCheck className="h-3 w-3" />
                <span className="capitalize">{role ?? "—"}</span>
              </div>
            </div>
            <button
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                nav2({ to: "/login" });
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs font-semibold hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> {sidebarExpanded && "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:h-full md:min-h-0 md:overflow-y-auto" tabIndex={-1}>
        <header className="md:hidden flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-white p-1">
              <img src={logo} alt="Justice League of Greater Lansing" className="h-8 w-auto" />
            </span>
            <span className="font-display text-xs font-black uppercase leading-tight text-sidebar-foreground sm:text-sm">
              Justice League Review
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/help"
              className="inline-flex min-h-11 items-center gap-1 text-xs text-sidebar-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Help
            </Link>
            <button
              onClick={async () => {
                await signOut();
                nav2({ to: "/login" });
              }}
              className="min-h-11 text-xs text-sidebar-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="md:hidden border-b border-border bg-card px-4 pt-3">
          {programs.length > 0 && (
            <Select
              value={selectedProgram?.slug ?? ""}
              onValueChange={(value) => {
                setSelectedProgram(value as "scholarship" | "business_growth_grant");
                nav2({ to: "/" });
              }}
            >
              <SelectTrigger aria-label="Current program" className="mb-3 min-h-11 font-semibold">
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
          <nav className="pb-3" aria-label="Mobile portal navigation">
            <label
              htmlFor="mobile-destination"
              className="mb-1 block text-xs font-semibold text-muted-foreground"
            >
              Navigate to
            </label>
            <select
              id="mobile-destination"
              value={
                [
                  ...nav.filter((item) => !item.adminOnly || canUseAdminNav),
                  ...mobileAdminDestinations(isProgramAdmin, !!selectedProgram),
                ].find(
                  (item) =>
                    item.to === loc.pathname ||
                    (item.to !== "/" && loc.pathname.startsWith(`${item.to}/`)),
                )?.to ?? "/"
              }
              onChange={(event) => nav2({ to: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background px-3 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {[
                ...nav.filter((item) => !item.adminOnly || canUseAdminNav),
                ...mobileAdminDestinations(isProgramAdmin, !!selectedProgram).map((item) => ({
                  ...item,
                  icon:
                    item.to === "/assignments"
                      ? ClipboardList
                      : item.to === "/testing"
                        ? FlaskConical
                        : UserCog,
                })),
              ].map((item) => (
                <option key={item.to} value={item.to}>
                  {item.to === "/assignments" ? assignmentLabel + assignmentAttention : item.label}
                </option>
              ))}
            </select>
          </nav>
        </div>
        <div
          className={cn(
            "px-4 py-6 md:px-8 md:py-8",
            isGrantDetail ? "w-full max-w-none" : "mx-auto max-w-[1400px]",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
