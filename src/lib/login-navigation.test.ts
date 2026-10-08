import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

test("client return navigation preserves the requested route, query and fragment", () => {
  const root = createRootRoute();
  const login = createRoute({ getParentRoute: () => root, path: "/login" });
  const portal = createRoute({
    getParentRoute: () => root,
    path: "/grants",
    validateSearch: (search) => search,
  });
  const router = createRouter({
    routeTree: root.addChildren([login, portal]),
    history: createMemoryHistory({ initialEntries: ["/login"] }),
  });
  // buildAndCommitLocation forwards these options to the location builder.
  const returnNavigation = { to: "." as const, href: "/grants?view=assigned#queue" };
  const destination = router.buildLocation(returnNavigation);
  assert.equal(destination.pathname, "/grants");
  assert.equal(destination.searchStr, "?view=assigned");
  assert.equal(destination.hash, "queue");
});

test("sign-in return navigation preserves browser auth instead of reloading SSR", async () => {
  const login = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");
  assert.match(login, /await nav\(\{ href: target, replace: true \}\)/);
  assert.doesNotMatch(login, /window\.location\.(assign|replace|reload)|reloadDocument: true/);
  assert.match(login, /safeLoginNext\(next\)/);
  assert.match(login, /!isPublicAuthRoute/);
});
