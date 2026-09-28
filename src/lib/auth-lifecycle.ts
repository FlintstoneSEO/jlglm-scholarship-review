export const PUBLIC_AUTH_ROUTES = [
  "/login",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
] as const;

export function isPublicAuthRoute(pathname: string) {
  return PUBLIC_AUTH_ROUTES.includes(pathname as (typeof PUBLIC_AUTH_ROUTES)[number]);
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}

export function normalizeAppUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function authRedirectUrl(appUrl: string, path: "/accept-invite" | "/reset-password") {
  const normalized = normalizeAppUrl(appUrl);
  if (!normalized) throw new Error("The application URL is not configured.");
  return `${normalized}${path}`;
}

export function browserAppUrl() {
  const configured = import.meta.env.VITE_APP_URL as string | undefined;
  if (configured) return normalizeAppUrl(configured);
  if (
    typeof window !== "undefined" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.origin)
  )
    return window.location.origin;
  throw new Error(
    "Password recovery is unavailable because the application URL is not configured.",
  );
}

export function authLinkError(location: Pick<Location, "search" | "hash">) {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  return query.get("error_description") ?? hash.get("error_description");
}
