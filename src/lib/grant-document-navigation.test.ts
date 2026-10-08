import test from "node:test";
import assert from "node:assert/strict";
import { openGrantDocument } from "./grant-document-navigation.ts";
import type { ReviewDocument } from "./review-domain";
const document = (url: string | null): ReviewDocument => ({
  id: "doc",
  label: "Supporting document",
  kind: "supporting",
  source: url ? "external" : "private_storage",
  url,
  storagePath: url ? null : "app/file.pdf",
});

test("PDF, spreadsheet and practice links open separately without replacing filtered application URL", async () => {
  const opened: (string | undefined)[][] = [];
  const browser = {
    open: (url: string, target: string, features?: string) => {
      const args = [url, target, features];
      opened.push(args);
      return null;
    },
  };
  for (const url of [
    "https://example.invalid/file.pdf",
    "https://docs.google.com/spreadsheets/d/synthetic/edit",
    "/practice-document?kind=profit_loss_2025",
  ])
    await openGrantDocument(document(url), "app", browser, async () => {
      throw new Error("External documents need no signer");
    });
  assert.deepEqual(
    opened.map((args) => args[0]),
    [
      "https://example.invalid/file.pdf",
      "https://docs.google.com/spreadsheets/d/synthetic/edit",
      "/practice-document?kind=profit_loss_2025&applicationId=app",
    ],
  );
  assert.ok(opened.every((args) => args[1] === "_blank" && args[2] === "noopener,noreferrer"));
});
test("private window opens before asynchronous signing and closes on failure", async () => {
  const events: string[] = [];
  const popup = {
    opener: {} as unknown,
    location: { replace: (url: string) => events.push(url) },
    close: () => events.push("close"),
  };
  const browser = {
    open: () => {
      events.push("open");
      return popup;
    },
  };
  await openGrantDocument(document(null), "app", browser, async (path) => {
    events.push(path);
    return "https://example.invalid/signed";
  });
  assert.deepEqual(events, ["open", "app/file.pdf", "https://example.invalid/signed"]);
  assert.equal(popup.opener, null);
  await assert.rejects(
    openGrantDocument(document(null), "app", browser, async () => {
      throw new Error("Signing denied");
    }),
    /Signing denied/,
  );
  assert.equal(events.at(-1), "close");
  await assert.rejects(
    openGrantDocument(document(null), "app", { open: () => null }, async () => "unused"),
    /Allow document pop-ups/,
  );
});
