-- Run once in the Supabase SQL editor after deploying the google-sheets-sync Edge Function.
-- Before running this script, create these values:
--   1. Edge Function secret GOOGLE_SHEETS_SYNC_CRON_TOKEN=<strong random value>
--   2. Vault secret with the same value:
--      select vault.create_secret('<strong random value>', 'jlgl_google_sheets_sync_cron_token');
-- The token is intentionally not stored in this repository or in a public table.

select cron.unschedule(jobid)
from cron.job
where jobname = 'jlgl-google-sheets-sync-every-15-minutes';

select cron.schedule(
  'jlgl-google-sheets-sync-every-15-minutes',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://dmrbadqkkucbcxgoqnnc.supabase.co/functions/v1/google-sheets-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-jlgl-sync-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'jlgl_google_sheets_sync_cron_token'
        )
      ),
      body := jsonb_build_object('action', 'sync')
    );
  $$
);
