import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { helpGuideKind } from "./help-guide.ts";
import { grantRubricGuidance } from "./grant-rubric-guidance.ts";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const route = read("../routes/_app.help.tsx");
const scholarship = read("../components/help/ScholarshipHelpGuide.tsx");
const grant = read("../components/help/BusinessGrowthGrantHelpGuide.tsx");

test("the shared route selects help from the selected program and uses neutral metadata", () => {
  assert.equal(helpGuideKind("scholarship"), "scholarship");
  assert.equal(helpGuideKind("business_growth_grant"), "business_growth_grant");
  assert.equal(helpGuideKind(null), "choose_program");
  assert.match(route, /helpGuideKind\(selectedProgram\?\.slug \?\? null\)/);
  assert.match(route, /guide === "business_growth_grant"/);
  assert.match(route, /BusinessGrowthGrantHelpGuide/);
  assert.match(route, /ScholarshipHelpGuide/);
  assert.match(route, /Help & Guide — Justice League Review Portal/);
  assert.doesNotMatch(route, /Scholarship Review portal/);
});

test("each section link has a rendered section in its own guide", () => {
  for (const [source, array] of [
    [scholarship, "scholarshipSections"],
    [grant, "grantSections"],
  ]) {
    const nav = source.match(new RegExp(`(?:export )?const ${array} = \\[([\\s\\S]*?)\\]`));
    assert.ok(nav);
    const ids = [...nav[1].matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(source, new RegExp(`<HelpSection id="${id}"`));
  }
});

test("Grant guide documents the active rubric and keeps Scholarship material separate", () => {
  assert.equal(grantRubricGuidance.length, 7);
  assert.equal(
    grantRubricGuidance.reduce((sum, item) => sum + item.maximum, 0),
    100,
  );
  assert.match(grant, /grantRubricGuidance\.map/);
  for (const phrase of [
    "Eligibility &amp; compliance",
    "2024 P&L",
    "2025 P&L",
    "LARA",
    "Reviewer certification",
    "Funding recommendation",
    "Decision Support Only",
  ])
    assert.ok(grant.includes(phrase), phrase);
  for (const phrase of [
    "Essay Quality",
    "Educational Goals",
    "transcript",
    "recommendation letters",
    "2026 Reparations Scholarship",
    "Education Cohort",
  ])
    assert.ok(!grant.toLowerCase().includes(phrase.toLowerCase()), phrase);
  assert.match(grant, /does not select Business Growth Grant recipients automatically/);
  assert.match(scholarship, /2026 Reparations Scholarship/);
  assert.match(scholarship, /Essay Quality/);
  assert.doesNotMatch(scholarship, /Business Growth Grant/);
});
