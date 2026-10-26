import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { mayChangeReviewContext } from "@/lib/review-departure";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/jlgl-logo.png";

type Destination = { to: string; label: string; icon: LucideIcon };

/** Presentation only: permitted destinations are supplied by the existing shell policy. */
export function GrantShell({
  children,
  destinations,
}: {
  children: ReactNode;
  destinations: Destination[];
}) {
  const { user, role, programs, selectedProgram, setSelectedProgram, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const primaryPaths = ["/", "/grants", "/help"];
  const primary = primaryPaths.flatMap((path) => destinations.filter((item) => item.to === path));
  const admin = destinations.filter((item) => !primaryPaths.includes(item.to));
  const active = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  const renderLink = (item: Destination) => (
    <Link
      key={item.to}
      to={item.to}
      aria-current={active(item.to) ? "page" : undefined}
      className="grant-nav-link"
    >
      <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
  return (
    <div className="portal-shell grant-shell">
      <a href="#grant-main" className="grant-skip-link">
        Skip to content
      </a>
      <header className="grant-masthead">
        <div className="grant-brand">
          <img src={logo} alt="" className="h-9 w-auto rounded-sm bg-white p-1" />
          <span className="font-semibold tracking-tight">Justice League</span>
          <span className="grant-brand-caption">Review Portal</span>
        </div>
        <div className="grant-program">
          <Select
            value={selectedProgram?.slug ?? ""}
            onValueChange={(value) => {
              if (!mayChangeReviewContext()) return;
              setSelectedProgram(value as "scholarship" | "business_growth_grant");
              navigate({ to: "/" });
            }}
          >
            <SelectTrigger
              aria-label="Current program"
              className="min-h-11 border-white/25 bg-transparent text-white"
            >
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
        <nav aria-label="Portal navigation" className="grant-primary-nav">
          {primary.map(renderLink)}
        </nav>
        <div className="grant-account">
          <span className="grant-account-identity" title={user?.email}>
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>
              <span className="block max-w-48 truncate text-xs">{user?.email}</span>
              <span className="text-xs capitalize text-white/70">
                {selectedProgram?.accessRole ?? role}
              </span>
            </span>
          </span>
          <button
            type="button"
            className="grant-nav-link"
            onClick={async () => {
              if (!mayChangeReviewContext()) return;
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>
      {admin.length > 0 && (
        <nav aria-label="Administration" className="grant-admin-nav">
          <span className="grant-admin-label">Administration</span>
          {admin.map(renderLink)}
        </nav>
      )}
      <nav aria-label="Mobile portal navigation" className="grant-mobile-nav">
        <label htmlFor="grant-destination">Navigate to</label>
        <select
          id="grant-destination"
          value={destinations.find((item) => active(item.to))?.to ?? "/"}
          onChange={(event) => navigate({ to: event.target.value })}
        >
          {[...primary, ...admin].map((item) => (
            <option key={item.to} value={item.to}>
              {item.label}
            </option>
          ))}
        </select>
      </nav>
      <main id="grant-main" tabIndex={-1} className="grant-main">
        <div
          className={`grant-page ${location.pathname.startsWith("/grants/") ? "grant-page-detail" : ""}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
