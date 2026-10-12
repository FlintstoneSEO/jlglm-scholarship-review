export type DepartureState = "allow" | "confirm_discard" | "wait_for_save";
export function reviewDepartureState(
  dirty: boolean,
  pending: boolean,
  bypass = false,
): DepartureState {
  if (pending) return "wait_for_save";
  return dirty && !bypass ? "confirm_discard" : "allow";
}

/** Program changes and sign-out change auth context before router blockers can run. */
export function mayChangeReviewContext(): boolean {
  return window.dispatchEvent(new Event("review-context-departure", { cancelable: true }));
}
