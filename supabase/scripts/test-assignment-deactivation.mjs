// Usage: node supabase/scripts/test-assignment-deactivation.mjs <PGlite module path>
// Disposable PostgreSQL only; this script never connects to a hosted database.
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage; create schema extensions;
    -- Original tables rely on Supabase's provider default table grants.
    alter default privileges in schema public grant all on tables to authenticated, anon;
    -- Supabase supplies this provider function; migrations only revoke its permissions.
    create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin return; end $$;
    create table auth.users(id uuid primary key, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, storage to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array($1,'/') $$;
  `);
  const files = (await readdir("supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    let sql = await readFile(`supabase/migrations/${file}`, "utf8");
    // PGlite lacks pgcrypto. No crypto operations are exercised by this suite.
    sql = sql.replace(/create extension if not exists pgcrypto;/gi, "");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  try {
    await db.exec(await readFile("supabase/tests/admin_assignment_deactivation.sql", "utf8"));
  } catch (error) {
    throw new Error(`SQL assertions: ${error.message}; ${error.where ?? ""}`);
  }
  console.log(
    `PASS: ${files.length} migrations loaded; assignment deactivation SQL assertions passed (rollback).`,
  );
} finally {
  await db.close();
}
