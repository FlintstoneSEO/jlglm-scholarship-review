import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { deferAuthWork } from "./defer-auth-work.ts";

const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.invalid" };
const session = {
  access_token: "fixture-access-token",
  refresh_token: "fixture-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};

test(
  "stored-session loading and password sign-in finish alongside deferred profile reads",
  { timeout: 3000 },
  async () => {
    const storageKey = "auth-lock-regression";
    const storage = new Map([[storageKey, JSON.stringify(session)]]);
    const events: string[] = [];
    const pending: Promise<void>[] = [];
    const client = createClient("https://fixture.supabase.invalid", "fixture-publishable-key", {
      auth: {
        storageKey,
        storage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => {
            storage.set(key, value);
          },
          removeItem: (key) => {
            storage.delete(key);
          },
        },
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          const url = String(input);
          if (url.includes("/token?grant_type=password")) {
            const body = JSON.parse(String(init?.body));
            return body.password === "correct-fixture-password"
              ? Response.json(session)
              : Response.json(
                  { code: "invalid_credentials", msg: "Invalid login credentials" },
                  { status: 400 },
                );
          }
          assert.ok(url.includes("/rest/v1/profiles"), `Unexpected fixture request: ${url}`);
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            `Bearer ${session.access_token}`,
          );
          return Response.json({ account_setup_completed: true });
        },
      },
    });
    const { data: listener } = client.auth.onAuthStateChange((event, currentSession) => {
      events.push(event);
      if (!currentSession) return;
      pending.push(
        new Promise<void>((resolve, reject) => {
          deferAuthWork(async () => {
            try {
              const { data, error } = await client
                .from("profiles")
                .select("account_setup_completed")
                .eq("id", currentSession.user.id)
                .maybeSingle();
              assert.equal(error, null);
              assert.equal(data?.account_setup_completed, true);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }),
      );
    });
    try {
      assert.equal((await client.auth.getSession()).data.session?.user.id, user.id);
      await Promise.all(pending);
      assert.ok(events.includes("INITIAL_SESSION"));

      const signInEventsBefore = events.filter((event) => event === "SIGNED_IN").length;
      const invalid = await client.auth.signInWithPassword({
        email: user.email,
        password: "wrong-password",
      });
      assert.equal(invalid.error?.message, "Invalid login credentials");
      assert.equal(events.filter((event) => event === "SIGNED_IN").length, signInEventsBefore);

      const valid = await client.auth.signInWithPassword({
        email: user.email,
        password: "correct-fixture-password",
      });
      assert.equal(valid.error, null);
      assert.equal(valid.data.user?.id, user.id);
      await Promise.all(pending);
      assert.equal(events.filter((event) => event === "SIGNED_IN").length, signInEventsBefore + 1);
      // The post-login route guard can still retrieve the persisted session.
      assert.equal((await client.auth.getSession()).data.session?.user.id, user.id);
    } finally {
      listener.subscription.unsubscribe();
      await client.auth.stopAutoRefresh();
    }
  },
);

test("deferred auth work waits until the callback and its microtasks finish", async () => {
  const order: string[] = [];
  await new Promise<void>((resolve) => {
    deferAuthWork(async () => {
      order.push("profile");
      resolve();
    });
    order.push("callback");
    void Promise.resolve().then(() => {
      order.push("sdk-release");
    });
  });
  assert.deepEqual(order, ["callback", "sdk-release", "profile"]);
});

test("both account-loading listeners use the tested deferral", async () => {
  const provider = await readFile(new URL("./auth-context.tsx", import.meta.url), "utf8");
  const invite = await readFile(
    new URL("../components/PasswordSetupForm.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    provider,
    /deferAuthWork\(async \(\) => \{\s+if \(!active \|\| current !== version\) return;/,
  );
  assert.doesNotMatch(provider, /Promise\.resolve\(\)\.then/);
  assert.match(invite, /deferAuthWork\(async \(\) => \{\s+if \(!active\) return;/);
});
