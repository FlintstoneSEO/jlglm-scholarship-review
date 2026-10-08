// Refreshing server data must not silently replace work being edited locally.
export function shouldHydrateGrantReview(currentKey: string, loadedKey: string, dirty: boolean) {
  if (!loadedKey || loadedKey === currentKey) return false;
  const sameApplication = !!currentKey && currentKey.split(":")[0] === loadedKey.split(":")[0];
  return !dirty || !sameApplication;
}

export function hasPendingGrantWork(input: {
  eligibilityDirty: boolean;
  reviewDirty: boolean;
  eligibilitySaving: boolean;
  reviewSaving: boolean;
}) {
  return Object.values(input).some(Boolean);
}
