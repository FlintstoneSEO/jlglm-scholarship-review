/** Production reporting is the default. Review queues opt into All explicitly. */
export type ApplicationScope = "real" | "test" | "all";
export const productionApplications = <T extends { is_test?: boolean }>(rows: readonly T[]) =>
  rows.filter((row) => row.is_test !== true);
export const testApplications = <T extends { is_test?: boolean }>(rows: readonly T[]) =>
  rows.filter((row) => row.is_test === true);
export function matchesApplicationScope(isTest: boolean, scope: ApplicationScope) {
  return scope === "all" || isTest === (scope === "test");
}
