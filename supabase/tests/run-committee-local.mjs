import fs from "node:fs";
import { PGlite } from "../.temp/committee-test/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
await db.exec(
  "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create schema extensions; create schema private;",
);
await db.exec(
  "create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', encrypted_password text, email_confirmed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz, aud text, role text, instance_id uuid, confirmation_token text default '', recovery_token text default '', email_change_token_new text default '', email_change text default '', invited_at timestamptz);",
);
await db.exec(
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.role() returns text language sql stable as $$ select current_user::text $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;",
);
await db.exec(
  "create table storage.buckets(id text primary key,name text, public boolean, file_size_limit bigint, allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text, name text, owner uuid, owner_id text, metadata jsonb); alter table storage.objects enable row level security; create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;",
);
await db.exec(
  "create function extensions.digest(bytea,text) returns bytea language sql immutable as $$ select sha256($1) $$; create function extensions.crypt(text,text) returns text language sql as $$ select $1 $$; create function extensions.gen_salt(text) returns text language sql as $$ select $1 $$;",
);
await db.exec(
  "grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role; grant all on all tables in schema storage to authenticated; alter default privileges in schema public grant all on tables to authenticated,service_role; alter default privileges in schema public grant usage,select on sequences to authenticated,service_role;",
);
await db.exec(
  "create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end $$;",
);
for (const file of fs
  .readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  let sql = fs
    .readFileSync("supabase/migrations/" + file, "utf8")
    .replace(/create extension if not exists pgcrypto;/gi, "");
  try {
    await db.exec(sql);
  } catch (e) {
    console.error("MIGRATION FAIL", file, e.message);
    await db.close();
    process.exit(1);
  }
}
await db.exec(
  "insert into auth.users(id,email) values('aa000000-0000-4000-8000-000000000000','bootstrap@example.invalid');",
);
console.log("PASS: all checked-in migrations applied to isolated PGlite PostgreSQL");
for (const file of process.argv.slice(2)) {
  try {
    await db.exec(fs.readFileSync(file, "utf8"));
    console.log("PASS:", file);
  } catch (e) {
    console.error("TEST FAIL", file, e.message, e.where ?? "");
    await db.close();
    process.exit(1);
  }
}
await db.close();
