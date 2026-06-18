-- ════════════════════════════════════════════════════════════════════════
--  EV Charging Booking — daily digest schedule (run AFTER deploying the
--  `daily-digest` Edge Function; see EMAIL-SETUP.md).
--  Schedules a 07:00 UTC daily call to the Edge Function via pg_cron + pg_net.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous copy so this file is re-runnable.
select cron.unschedule('ev-daily-digest')
  where exists (select 1 from cron.job where jobname = 'ev-daily-digest');

-- 07:00 UTC every day. (Note: UK clocks = UTC in winter, UTC+1 in summer, so
-- in British Summer Time this arrives ~08:00 local. Adjust the cron if you
-- want a fixed 07:00 *local* — say the word and I'll switch it.)
select cron.schedule(
  'ev-daily-digest',
  '0 7 * * *',
  $$
    select net.http_post(
      url     := 'https://zkmmazyybabztqvvefpe.functions.supabase.co/daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        -- Use your project's anon public key (same one in config.js). It only
        -- gets the request past the Edge gateway; the function reads the DB
        -- with its own service-role key.
        'Authorization', 'Bearer YOUR-ANON-PUBLIC-KEY'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Handy: list scheduled jobs / their last runs
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
