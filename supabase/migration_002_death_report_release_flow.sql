-- Migratie 002: Fase 2 afhandelproces overlijdensmelding
--
-- Wat dit toevoegt:
--   1. report_death() uitgebreid met deceased_email + is_new, zodat de client precies kan
--      tonen of een melding nieuw is, al loopt, of al gedeeld is — zonder lokale state te
--      raadplegen.
--   2. process_expired_death_reports(): zet, in één atomaire stap, elke 'waiting' melding
--      waarvan de wachttijd verstreken is op 'shared' en de bijbehorende profiles-rij op
--      checkin_status = 'shared'. Retourneert exact de accounts die zojuist zijn overgegaan.
--   3. trigger_release_check(): wrapper die process_expired_death_reports() aanroept en, als
--      er accounts zijn vrijgegeven, één keer de send-release-notification Edge Function
--      aanroept via pg_net.
--   4. pg_net + pg_cron extensies, en een dagelijkse cron-job (05:00 UTC) die
--      trigger_release_check() aanroept.
--
-- Beveiliging: process_expired_death_reports() en trigger_release_check() zijn met opzet
-- alleen uitvoerbaar door postgres/service_role — geen enkele anon/authenticated-gebruiker
-- mag deze zelf kunnen aanroepen via de API.
--
-- LET OP over het secret: de versie van dit bestand op schijf bevat een placeholder voor het
-- CRON_SECRET. De live database bevat het echte, eenmalig gegenereerde secret (rechtstreeks
-- via de Supabase MCP toegepast, niet via dit bestand) — datzelfde secret moet als Edge
-- Function secret CRON_SECRET worden gezet zodat send-release-notification de aanroep kan
-- verifiëren.

drop function if exists public.report_death(text, text, text, text, text, text);

create or replace function public.report_death(
  p_target_email text,
  p_reporter_name text,
  p_reporter_email text,
  p_reporter_phone text default ''::text,
  p_relationship text default ''::text,
  p_message text default ''::text
)
returns table(result_status text, deceased_name text, deceased_email text, is_new boolean)
language plpgsql
security definer
as $function$
declare
  acc profiles;
  existing death_reports;
begin
  select * into acc from profiles where lower(email) = lower(p_target_email) limit 1;
  if acc.id is null then
    return query select 'not_found'::text, ''::text, ''::text, false;
    return;
  end if;

  select * into existing from death_reports
    where target_account_id = acc.id and status in ('waiting', 'shared')
    order by reported_at desc limit 1;

  if existing.id is not null then
    return query select existing.status, acc.name, acc.email, false;
    return;
  end if;

  insert into death_reports (target_email, target_account_id, reporter_name, reporter_email, reporter_phone, relationship, message, status, waiting_until)
    values (lower(p_target_email), acc.id, p_reporter_name, p_reporter_email, p_reporter_phone, p_relationship, p_message, 'waiting', now() + interval '30 days');

  update profiles set checkin_status = 'waiting', waiting_started_at = now() where id = acc.id;

  return query select 'waiting'::text, acc.name, acc.email, true;
end;
$function$;

grant execute on function public.report_death(text, text, text, text, text, text) to anon, authenticated;

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.process_expired_death_reports()
returns table(account_id uuid, deceased_name text, deceased_email text)
language plpgsql
security definer
as $function$
begin
  return query
  with expired as (
    update death_reports
    set status = 'shared', shared_at = now()
    where status = 'waiting' and waiting_until <= now()
    returning target_account_id, target_email
  ),
  updated_profiles as (
    update profiles p
    set checkin_status = 'shared'
    from expired e
    where p.id = e.target_account_id
    returning p.id as account_id, p.name as deceased_name
  )
  select up.account_id, up.deceased_name, e.target_email as deceased_email
  from updated_profiles up
  join expired e on e.target_account_id = up.account_id;
end;
$function$;

revoke execute on function public.process_expired_death_reports() from public, anon, authenticated;

create or replace function public.trigger_release_check()
returns void
language plpgsql
security definer
as $function$
declare
  released jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'account_id', account_id,
    'deceased_name', deceased_name,
    'deceased_email', deceased_email
  )), '[]'::jsonb)
  into released
  from process_expired_death_reports();

  if jsonb_array_length(released) > 0 then
    perform net.http_post(
      url := 'https://prkwfuiadjfpdmcorfas.supabase.co/functions/v1/send-release-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '__CRON_SECRET__'),
      body := jsonb_build_object('released', released),
      timeout_milliseconds := 10000
    );
  end if;
end;
$function$;

revoke execute on function public.trigger_release_check() from public, anon, authenticated;

select cron.schedule(
  'release-check-daily',
  '0 5 * * *',
  $$select public.trigger_release_check();$$
);

-- Hardening: vast search_path op de SECURITY DEFINER-functies hierboven, zodat ze niet via een
-- gemanipuleerd search_path naar verkeerde objecten kunnen worden omgeleid (linter-waarschuwing
-- function_search_path_mutable).
alter function public.report_death(text, text, text, text, text, text) set search_path = public;
alter function public.process_expired_death_reports() set search_path = public;
alter function public.trigger_release_check() set search_path = public, net;
