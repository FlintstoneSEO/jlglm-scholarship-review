# AGENTS.md

## Mission

Create websites and web applications that are strategically appropriate, visually distinctive, accessible, responsive, performant, and effective for their users. Make public sites conversion-focused and search-engine comprehensible; make applications reliable for their users' tasks and data.

## Justice League Review Portal

This repository is the Justice League of Greater Lansing review portal. It supports multiple programs, currently Educational Scholarship and Business Growth Grant. The architectural target is **one review portal, one review workflow, one rubric engine, multiple program configurations**.

Do not assume differences between the Scholarship and Business Growth Grant review implementations are intentional product requirements. When equivalent workflows differ, inspect both implementations, document the difference, identify shared domain primitives, determine whether the workflow can be unified safely, and keep program-specific application content separate from shared review mechanics. The review engine should eventually be program-agnostic wherever the underlying business rules permit it.

Program-specific areas may include application fields, displayed applicant information, supporting document types, rubric criteria and descriptions, maximum points, and eligibility requirements. Investigate reviewer queues and assignments, application review workspaces, status and progress, document viewing, rubric rendering, score persistence, comments, Save Draft, Submit Review, completion tracking, admin monitoring, score comparison, and rankings as potential shared mechanics.

Do not change scoring semantics, eligibility rules, review assignment behavior, authentication, authorization, database meaning, or persisted data without first documenting existing behavior and migration implications. Existing Supabase schema and authorization policies are production constraints. Preserve the TanStack Start and React application, its file routes, role and program access model, and Cloudflare deployment conventions unless a separately authorized change requires a documented migration. Read `README.md` and `docs/architecture-audit.md` as existing context, and verify their claims against current code and migrations before relying on them; the audit document describes an earlier baseline and plan.

For the next phase, run `skills/application-redesign/SKILL.md` in **audit-only mode**. Produce its audit and unification recommendation without modifying application code, routes, schema, policies, assignments, or persisted data. Do not begin a visual redesign as part of that audit.

## Reusable-agent source of truth

The canonical reusable design-agent source is `FlintstoneSEO/codex-frontend-design-agent`. The `skills/`, `research/`, `references/`, and `templates/` copies here are project-local snapshots used during implementation. Keep Justice League-specific instructions here in `AGENTS.md`. Make generic improvements that benefit other projects upstream first, then sync them downstream. Do not let this repository's snapshot diverge into a separate reusable agent.

## Delivery and platform rules

Build production websites in the project's native platform and architecture. A standalone HTML file is a prototype or embed deliverable, not the default definition of a finished website.

Before implementation, inspect the repository for its framework, package manager, CMS, deployment configuration, existing components, content model, integrations, and local validation commands. Preserve those conventions unless the requested change requires a documented migration.

- Existing project: extend its established framework and architecture. Do not replace an Astro, Shopify, Wix, WordPress, React, Next.js, or other working project with static files.
- New marketing or nonprofit site with no requested platform: use Astro and make content editing compatible with the chosen CMS or hosting workflow. Use CloudCannon conventions when CloudCannon is selected.
- Shopify store: work in the active theme's sections, blocks, templates, assets, and Liquid conventions. Do not substitute a standalone storefront mockup.
- Wix site: use Wix-native pages, CMS, forms, and app capabilities. Use a custom element only when native capabilities cannot meet the requirement, and define its data and editing boundary.
- Website requiring authenticated users, submissions, workflow states, or persistent data: design and implement the appropriate backend, data model, authorization rules, and validation. Do not simulate the capability with static UI.
- Standalone HTML is permitted only when the user explicitly asks for an HTML mockup, an embed snippet, a prototype, or a framework-independent artifact.

For this portal, treat browser Supabase access, row-level security, server-only credentials, and existing authentication flows as distinct boundaries. Rendering or hiding a control is not authorization. Verify changes to data access against the relevant policies and roles before release.

When the platform is unknown, ask which platform will host the site if that choice materially affects the implementation. If a reasonable default is needed, state the selected stack and why before creating files.

## Flintstone SEO attribution

Every delivered public website footer must include a visible, unobtrusive attribution linking to `https://www.flintstoneseo.com/` with the exact visible text: `Design by Flintstone SEO`. This rule does not require introducing a footer into an authenticated application screen during a redesign.

- Place it with the footer's secondary/legal content, not in the primary navigation or main page content.
- Retain accessible text, adequate contrast, and the site's normal link and focus treatment.
- Do not use a logo-only treatment or hide the attribution visually.
- Preserve the attribution across page templates and CMS-rendered layouts.

## Non-negotiable sequence

For public-facing website pages, do not code until these artifacts exist:

1. Completed project brief, including visible unknowns and assumptions
2. Three substantially different art directions
3. Selected art direction and decision rationale
4. Approved information architecture
5. Page specification for the page being implemented
6. Implementation-ready page composition map, either inside the page specification or as a linked artifact

A substantially different art direction changes page rhythm, content emphasis, section composition vocabulary, image behavior, density, whitespace, typography scale relationships, alignment, hierarchy sources, component grammar, and interaction treatment. A palette or font swap does not qualify.

The composition map must define each major section's purpose, composition archetype, dominant element, hierarchy source, alignment, media behavior, CTA behavior, and mobile adaptation before implementation begins.

For authenticated or workflow-driven application screens, use `application-redesign` when the work is a substantial redesign. Before implementation, record the application audit, major role-specific workflows and states, preservation and data constraints, proposed shared primitives, selected visual direction and rationale, approved navigation/IA changes, and an implementation-ready screen specification. Apply the three-direction exploration where a material visual redesign is requested; adapt page composition maps to task hierarchy, information density, actions, states, and responsive behavior rather than forcing marketing sections onto application screens. An audit-only request may stop before implementation.

## Truthfulness

- Never invent client facts, awards, reviews, ratings, prices, availability, addresses, credentials, results, statistics, team members, or testimonials.
- Mark unresolved values as `[NEEDS CLIENT INPUT: ...]`.
- Mark temporary implementation copy as `[PLACEHOLDER: ...]`.
- Record consequential assumptions in `templates/design-decision-log.md`.

## Design rules

- Design from business context and user intent, not from a default landing-page formula.
- Distinguish consistency from sameness. Consistency should primarily come from typography, color, spacing systems, interaction behavior, imagery treatment, iconography, and brand voice. Variety may come from composition, scale, density, alignment, section height, media placement, whitespace, content hierarchy, interaction, and sequencing.
- Component reuse and visual consistency are not the same as repeating the same composition. Reuse tokens and primitives aggressively. Reuse major section compositions only when the content relationship genuinely calls for the same structure.
- A design system should constrain visual language without forcing every page into the same sentence structure.
- Do not automatically use an oversized hero, centered headline, three cards, gradient background, glass panels, pills, or rounded containers.
- Use cards only for separate objects users benefit from scanning, comparing, sorting, or selecting.
- Every section must have a defined user or business purpose.
- Major design choices require a rationale.
- The visual identity should remain recognizable when the logo is removed.
- Do not reproduce the identifiable composition, artwork, copy, or interaction sequence of a reference website.
- Prefer authentic client imagery. Disclose and constrain AI imagery. Never imply synthetic people are actual staff, customers, beneficiaries, or athletes.
- Use [Lucide](https://lucide.dev) as the default icon system for interface icons when the project does not already use an approved icon library. Import only the icons that are rendered; do not substitute emoji, hand-drawn SVGs, or a second general-purpose icon pack where Lucide has an appropriate icon.
- Preserve an existing project icon system unless the request includes a deliberate migration. Use the platform-native Lucide package when adding it: `lucide-astro`, `lucide-react`, `lucide-vue-next`, or `lucide-svelte`.
- Decorative icons must be hidden from assistive technology. Icon-only controls need an accessible name, visible keyboard focus, and a tooltip when the meaning is not obvious.
- Compose mobile deliberately. Do not merely stack desktop columns.
- Preserve each composition's design idea on mobile through priority, scale, spacing, crop, sequence, or interaction. An asymmetric section must not automatically become a bland centered stack.
- Use semantic HTML before ARIA. Use native controls whenever possible.
- Accessibility, SEO, and performance are planning constraints, not final audits.

### Header and site-shell diversity

Treat the header, navigation shell, and its relationship to the hero as first-order art-direction decisions rather than neutral chrome.

- Do not default automatically to `logo left -> horizontal nav -> CTA right`. Use that pattern only when the navigation depth, brand posture, conversion goal, content density, and selected art direction justify it.
- Before implementation, document the chosen header or site-shell archetype, why it fits the project, how it relates to the hero or first content region, whether it is static, sticky, floating, transparent, layered, split-row, centered, utility-led, rail-based, or otherwise structured, and how it adapts on mobile.
- Consider alternatives such as centered-brand navigation, split navigation, editorial mastheads, utility-bar systems, compact conversion headers, hero-integrated navigation, floating contained navigation, asymmetric brand-led shells, category or mega navigation, and vertical or rail navigation when supported by the content.
- Header archetypes are a vocabulary, not a rotation. Do not force novelty when the conventional structure is the strongest solution.
- Across redesigns, explicitly classify the existing header as preserve, improve, restructure, replace, or remove. Retaining the same shell requires a project-specific rationale, not familiarity.
- The three proposed art directions should not silently share the same header architecture. If the same architecture is necessary across directions because of hard constraints, document the constraint and vary its hierarchy, relationship to the hero, density, interaction, or responsive behavior meaningfully.
- Mobile navigation is a composition, not merely a desktop menu collapsed behind a hamburger. Define priority, CTA behavior, disclosure pattern, hierarchy, touch targets, focus management, and how brand presence changes at small widths.
- Preserve semantic navigation, keyboard access, visible focus, current-page indication where useful, and adequate contrast in every shell treatment.

Use `research/header-site-shell-patterns.md` as a vocabulary and decision aid, not as a template catalog.

### Section hierarchy diversity

For a typical marketing page with five or more major content sections, apply these as content-sensitive heuristics rather than quotas:

- Use eyebrow or kicker labels on no more than roughly 40% of major sections unless the labels carry necessary orientation or category information.
- Do not use `eyebrow -> heading -> paragraph` for consecutive major sections without a documented reason. Do not populate an eyebrow merely because a component or CMS field supports one.
- Omit generic labels such as `OUR SERVICES`, `WHY US`, `OUR PROCESS`, `ABOUT US`, and `LEARN MORE` when they add no context. Prefer useful labels such as `Step 02`, `Since 1998`, `Lansing, Michigan`, `For Parents`, `Case Study`, or a real category.
- Avoid more than three consecutive sections with the same primary alignment.
- Avoid consecutive sections with identical container width, vertical padding, heading width, and text rhythm unless the repetition communicates a meaningful relationship.
- On a sufficiently long page, let at least two major sections derive hierarchy from something other than a conventional heading block when supported by the content: imagery, products, statistics, quotes, numbered steps, portfolio work, diagrams, maps, comparisons, timelines, schedules, pricing, testimonials, large statements, or interactive controls.
- Do not force variety when the content cannot support it. Record intentional repetition and its rationale in the page composition map.

Use `research/section-composition-patterns.md` as a vocabulary, not a rotation of templates.

### Typography integrity

- Treat headline wrapping as part of the composition, not as an incidental browser outcome.
- At required review widths, prominent text must not leave isolated characters, punctuation, awkward word fragments, or clearly avoidable orphan lines.
- When a heading wraps poorly despite available space, reconsider grid allocation, inline size, heading measure, fluid scale, font size, letter spacing, adjacent column proportions, and then the composition before inserting a manual break or simply shrinking the type.
- Use manual heading line breaks only when they express the selected art direction, improve the composition, and have been verified across supported viewports.

### Whitespace and composition balance

- Whitespace must frame, separate, emphasize, or create intentional rhythm. Large unused regions are not automatically premium, editorial, or modern.
- Review split layouts as one composition rather than two independently positioned columns. Their start positions, heights, visual anchors, and centers of gravity must form an intentional relationship.
- Avoid artificial hero dead space caused by excessive viewport height, padding, hard-coded offsets, or bottom alignment without a documented compositional reason.
- Position primary messaging intentionally relative to adjacent media and the viewport fold. Preserve purposeful asymmetry, but remediate empty space that has no clear compositional job.

### CMS content models

CMS schemas must preserve composition-specific semantics rather than homogenize every section into `eyebrow`, `heading`, `description`, and `button`. Model editorial stories, metrics, quotes, processes, showcases, and other compositions with fields that match their content. An optional eyebrow field is acceptable; its presence never implies that it should be populated.

## Default quality targets

- WCAG 2.2 Level AA
- No horizontal overflow at 320 CSS pixels
- Functional keyboard path and visible focus
- Text contrast at least 4.5:1, or 3:1 for qualifying large text
- Core Web Vitals at the 75th percentile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1
- Exactly one descriptive H1 on normal content pages
- Unique title and meta description for indexable pages
- Valid canonical strategy, sitemap, robots directives, and structured data
- No fabricated structured-data properties
- Visual review at 375, 390, 768, 1024, and 1440 pixels

## Skill routing

- Incomplete product context: `skills/design-discovery/SKILL.md`
- Substantial authenticated portal or review workflow redesign, including audit-only mode: `skills/application-redesign/SKILL.md`
- Material visual direction changes: `skills/art-direction-generator/SKILL.md`
- Navigation or route planning: `skills/information-architecture/SKILL.md`
- Authorized implementation: `skills/frontend-ui-builder/SKILL.md`
- Rendered interface critique: `skills/visual-design-review/SKILL.md` and `skills/responsive-design-review/SKILL.md`
- Accessibility compliance: `skills/accessibility-audit/SKILL.md`
- Runtime and payload performance: `skills/performance-review/SKILL.md`
- Generic template-pattern check: `skills/anti-template-review/SKILL.md`
- Integrated pre-release verification: `skills/website-qa/SKILL.md`

The copied skills also mention `site-redesign`, `technical-seo-audit`, `industry-design-research`, and `page-content-planner` for public marketing work. They are not part of this authenticated portal workflow and are intentionally absent from this project-local snapshot. If public surfaces enter scope, sync their relevant upstream skills and references before using that workflow.

## Required review output format

Every issue must contain:

- Severity: blocker, high, medium, or low
- Element or file
- Viewport, route, or state
- Observed problem
- Evidence
- Exact recommended change
- Reason
- Expected outcome
- Verification method

Avoid vague feedback such as “make it pop,” “clean it up,” or “improve spacing.”

## Stop conditions

Stop implementation and request or visibly record missing input when:

- The primary conversion for a public site, or the primary user task for an application, is unknown.
- The organization or product facts are unverified.
- Required legal, pricing, location, schedule, or availability content is absent.
- The intended audience is materially ambiguous.
- The chosen visual direction conflicts with available media or accessibility requirements.
