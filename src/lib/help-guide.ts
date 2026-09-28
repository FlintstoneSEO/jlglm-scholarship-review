import type { ProgramSlug } from "./auth-context";

export type HelpGuideKind = ProgramSlug | "choose_program";

export function helpGuideKind(slug: ProgramSlug | null): HelpGuideKind {
  return slug ?? "choose_program";
}
