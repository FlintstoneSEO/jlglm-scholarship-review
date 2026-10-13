import assert from "node:assert/strict";
import { test } from "node:test";
import { readRememberedEmail, saveRememberedEmail } from "./remembered-email.ts";

test("email preference is opt-in, trims email and removes only its own storage key", () => {
  const values = new Map<string, string>([["supabase-session", "preserve"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  try {
    assert.equal(readRememberedEmail(), null);
    assert.equal(saveRememberedEmail(" reviewer@example.invalid "), true);
    assert.equal(readRememberedEmail(), "reviewer@example.invalid");
    assert.equal(saveRememberedEmail(null), true);
    assert.equal(readRememberedEmail(), null);
    assert.deepEqual([...values], [["supabase-session", "preserve"]]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("blocked browser storage does not throw or falsely report a saved preference", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new Error("Storage denied");
      },
    },
  });
  try {
    assert.equal(readRememberedEmail(), null);
    assert.equal(saveRememberedEmail("reviewer@example.invalid"), false);
    assert.equal(saveRememberedEmail(null), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
