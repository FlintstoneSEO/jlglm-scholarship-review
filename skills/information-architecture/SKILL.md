# information-architecture

## Activation

Use when planning routes, navigation, content grouping, or conversion paths.

## Purpose

Create a user-intent-driven sitemap and navigation model.

## Required inputs

- Project brief
- Content inventory
- Industry brief
- Search-intent map

## Workflow

1. Group content by audience task.
2. Define primary and utility navigation.
3. Map primary/secondary conversion paths.
4. Define URL hierarchy and internal links.
5. Test labels and depth against top tasks.

## Output

Sitemap, navigation model, route table, internal-link map, content gaps.

## References

- `research/seo-standards.md`
- For public-site work, sync the relevant upstream industry research before using an industry brief. This portal snapshot does not include industry-specific research.

## Scripts and tools

Use repository-native tooling first. Applicable tools may include browser screenshots, Playwright, axe-core, Lighthouse, HTML validation, schema validation, link checking, and asset-budget scripts. Do not claim a test ran unless evidence was produced.

## Failure conditions

- Primary user tasks are unknown
- Pages are created only to target duplicate city keywords

## Quality checks

- [ ] Every page has purpose
- [ ] Labels are descriptive
- [ ] No orphan pages
- [ ] Mobile navigation considered

## Dependencies

- `design-discovery`
- `industry-design-research`
