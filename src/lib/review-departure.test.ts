import assert from "node:assert/strict";
import test from "node:test";
import { reviewDepartureState } from "./review-departure.ts";
test("dirty review departure confirms discard; unchanged and persisted work can leave", () => {
  assert.equal(reviewDepartureState(true, false), "confirm_discard");
  assert.equal(reviewDepartureState(false, false), "allow");
});
test("in-flight writes block departure even after a successful screening navigation bypass", () => {
  assert.equal(reviewDepartureState(false, true), "wait_for_save");
  assert.equal(reviewDepartureState(true, true, true), "wait_for_save");
  assert.equal(reviewDepartureState(true, false, true), "allow");
});
