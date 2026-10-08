export function mobileAdminDestinations(isProgramAdmin: boolean, hasSelectedProgram: boolean) {
  return isProgramAdmin && hasSelectedProgram
    ? [
        { to: "/testing", label: "Testing" },
        { to: "/assignments", label: "Reviewer Assignments" },
        { to: "/users", label: "Users & Access" },
      ]
    : [];
}
