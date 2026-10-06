import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
/** Keep portal-hosted sample evidence inside the authenticated router. */
export function ApplicationDocumentLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith("/practice-document?")) {
    const params = new URL(href, "https://portal.invalid").searchParams;
    return (
      <Link
        to="/practice-document"
        search={{
          kind: params.get("kind") ?? "lara_documentation",
          applicationId: params.get("applicationId") ?? "",
          applicantId: params.get("applicantId") ?? "",
        }}
      >
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
