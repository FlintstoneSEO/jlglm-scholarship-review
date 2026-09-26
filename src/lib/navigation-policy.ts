export function mobileAdminDestinations(isProgramAdmin: boolean, hasSelectedProgram: boolean) {
  return isProgramAdmin && hasSelectedProgram
    ? [{ to: "/assignments", label: "Reviewer Assignments" }, { to: "/users", label: "Users & Access" }]
    : [];
}
