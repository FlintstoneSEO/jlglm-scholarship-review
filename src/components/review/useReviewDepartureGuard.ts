import { useEffect } from "react";
import { reviewDepartureState } from "@/lib/review-departure";
import { useBlocker } from "@tanstack/react-router";

/** Browser warnings supplement explicit saving; they do not persist private input. */
export function useReviewDepartureGuard(
  dirty: boolean,
  pending: boolean | (() => boolean),
  bypass: () => boolean = () => false,
) {
  const shouldBlock = () => {
    const isPending = typeof pending === "function" ? pending() : pending;
    const state = reviewDepartureState(dirty, isPending, bypass());
    if (state === "wait_for_save") {
      window.alert("Please wait for saving to finish before leaving this application.");
      return true;
    }
    return (
      state === "confirm_discard" &&
      !window.confirm(
        "Leave this application? Unsaved review or eligibility changes will be lost. Choose Cancel to stay and Save draft.",
      )
    );
  };
  useEffect(() => {
    const onDeparture = (event: Event) => {
      if (shouldBlock()) event.preventDefault();
    };
    window.addEventListener("review-context-departure", onDeparture);
    return () => window.removeEventListener("review-context-departure", onDeparture);
  });
  useBlocker({
    shouldBlockFn: shouldBlock,
    enableBeforeUnload: () => dirty || (typeof pending === "function" ? pending() : pending),
  });
}
