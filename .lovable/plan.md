## Goal

Give committee members an in-app guide for how to use the Scholarship Review Portal, easy access back to it any time, and contextual reviewing tips on the applicant scoring tab.

## What gets built

### 1. New Help / How-to-Use page (`/help`)

Create `src/routes/_app.help.tsx` — a comprehensive but scannable guide with sections:

- **Welcome** — purpose of the portal, the committee-makes-final-decision rule.
- **Roles** — what Admin / Reviewer / Viewer can do.
- **Dashboard** — what the stats mean.
- **Applicants list** — search, filter, status badges, missing documents indicator.
- **Reviewing an applicant** — opening a record, the Information / Documents / Scoring / Notes / Contact tabs, how scoring works (criteria, 0–100 total), recommendation values (Strong yes / Yes / Maybe / No), saving vs. updating a review.
- **Top Applicants** — how ranking is computed from committee scores.
- **Contact Center** — sending and logging applicant outreach.
- **Import Data (Admin)** — uploading applicant data.
- **Important rule** — final selection is made by the committee, not the app.
- **Need more help?** — contact line for the committee chair.

Layout: Tailwind/shadcn `Card` blocks with `lucide-react` icons, anchor links across the top for jumping to each section.

### 2. Sidebar nav entry

In `src/components/AppShell.tsx`, add a `Help & Guide` item (HelpCircle icon) to the `nav` array so users can return any time from desktop sidebar and (already-rendered) mobile flow.

### 3. Header Help button

In `AppShell.tsx`, add a small "Help" button (icon + label) in the mobile header next to Sign out, and a compact help icon button at the top of the desktop main area, both linking to `/help`.

### 4. First-visit auto-redirect / banner

On the dashboard (`src/routes/_app.index.tsx`), show a dismissible welcome banner the first time a user lands on it:

- Stored in `localStorage` under `jlgl.helpSeen.<userId>`.
- Banner: "New here? Read the quick guide" with a button linking to `/help` and a "Dismiss" button.
- Once dismissed it does not reappear for that user/browser.

### 5. Inline reviewing tips on the Scoring tab

In `src/routes/_app.applicants.$id.tsx`, inside `ScoringPanel`, add a collapsible tip card above the score inputs:

- One-paragraph explainer of what each score field measures (Academic, Financial Need, Community Impact, Essay, etc. — matching the existing fields).
- Reminder: "Your scores help the committee rank candidates. The committee makes the final selection."
- Link: "Open full reviewing guide" → `/help#reviewing`.
- Uses shadcn `Collapsible`, defaults open the first time per user (localStorage flag), collapsible after.

## Technical notes

- New route file: `src/routes/_app.help.tsx` using `createFileRoute("/_app/help")`. The route tree regenerates automatically.
- Reuse existing shadcn components (`Card`, `Button`, `Collapsible`, `Separator`, `Badge`); no new deps.
- All copy reflects the actual current feature set in the app (verified against `_app.index.tsx`, `_app.applicants.index.tsx`, `_app.applicants.$id.tsx`, `_app.top.tsx`, `_app.contact.tsx`, `_app.import.tsx`).
- No DB or auth changes required.

## Out of scope

- No video/walkthrough content.
- No per-role gated help variants (single page covers all roles, with role labels inline).
- No interactive product tour overlay.
