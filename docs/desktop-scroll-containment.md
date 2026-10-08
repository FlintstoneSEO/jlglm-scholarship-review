# Desktop duplicate scrollbar correction

- Severity: medium.
- Element/files: `AppShell.tsx` desktop main and document overflow in `styles.css`.
- Route/state: supplied Business Growth Grant detail Overview screenshot; shared authenticated desktop shell, 768 CSS pixels and above.
- Observed problem: two adjacent vertical scrollbar tracks occupy the right edge of the supplied screenshot.
- Evidence: the screenshot establishes duplicate scrolling. Current source gives the desktop main `overflow-y-auto` and constrains the shell to `100dvh`, but leaves document overflow unconstrained. The Grant workspace has natural content height without another vertical scroll container. No live DOM inspection was available, so the exact element producing the outer track remains unverified.
- Exact change: identify the shared shell with `portal-shell`; suppress html/body overflow only while that shell is present at the desktop breakpoint; size main to its parent's height and give it a zero minimum height.
- Reason: enforce the existing Phase E specification that desktop main owns content scrolling, while preserving the sidebar's separate navigation overflow where required.
- Expected outcome: one right-edge vertical scrollbar for application content. Mobile retains document scrolling; login and other pages outside the shell retain their existing behavior. Application sections continue to grow naturally.
- Verification method: TypeScript, scoped lint, and production build; authenticated browser follow-up at 320, 375, 390, 768, 1024, and 1440 CSS pixels. Verify long Overview/Application/Rubric content, bottom actions, wheel and keyboard scrolling, sidebar navigation, dialogs, logout/login, and desktop-to-mobile resizing. Browser verification remains pending because no browser surface was available in this session.

This correction changes presentation only and requires no database migration, deployment, or review workflow changes.

Local validation: PASS for `npx.cmd tsc --noEmit`, scoped AppShell ESLint, `git diff --check`, and `npm.cmd run build`. The build reported dependency annotation/directive warnings. Rendered and deployed verification: NEEDS MANUAL VALIDATION.
