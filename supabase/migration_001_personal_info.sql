-- AfterFile — migratie 001: persoonsgegevens + volledige overlijdensmelding-velden
-- Voer dit uit NA schema.sql (die je al succesvol hebt gedraaid). Dit voegt alleen kolommen
-- toe en vervangt één functie — geen DROP/recreate van tabellen, dus veilig te draaien
-- zonder bestaande data te verliezen. Plak dit hele bestand in de Supabase SQL Editor
-- (Project > SQL Editor > New query) en klik Run.

-- ---------- profiles: ontbrekende "Mijn gegevens"-velden ----------
alter table profiles add column if not exists full_name text not null default '';
alter table profiles add column if not exists street text not null default '';
alter table profiles add column if not exists postal_code text not null default '';
alter table profiles add column if not exists city text not null default '';
alter table profiles add column if not exists birth_date text not null default '';
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists completed_at timestamptz;

-- ---------- death_reports: ontbrekende velden van de melder ----------
alter table death_reports add column if not exists reporter_phone text not null default '';
alter table death_reports add column if not exists relationship text not null default '';
alter table death_reports add column if not exists message text not null default '';

-- ---------- report_death(): vervangen door een versie met de extra meldervelden ----------
-- Functie-argumenten kunnen niet met CREATE OR REPLACE worden uitgebreid met nieuwe
-- verplichte parameters op deze manier, dus eerst de oude versie verwijderen en daarna de
-- nieuwe aanmaken. (Wordt in app.js nog niet aangeroepen — dat is een volgende stap.)
drop function if exists report_death(text, text, text);

create function report_death(
  p_target_email text,
  p_reporter_name text,
  p_reporter_email text,
  p_reporter_phone text default '',
  p_relationship text default '',
  p_message text default ''
)
returns table (result_status text, deceased_name text) as $$
declare
  acc profiles;
  existing death_reports;
begin
  select * into acc from profiles where lower(email) = lower(p_target_email) limit 1;
  if acc.id is null then
    return query select 'not_found'::text, ''::text;
    return;
  end if;

  select * into existing from death_reports
    where target_account_id = acc.id and status in ('waiting', 'shared')
    order by reported_at desc limit 1;

  if existing.id is not null then
    return query select existing.status, acc.name;
    return;
  end if;

  insert into death_reports (target_email, target_account_id, reporter_name, reporter_email, reporter_phone, relationship, message, status, waiting_until)
    values (lower(p_target_email), acc.id, p_reporter_name, p_reporter_email, p_reporter_phone, p_relationship, p_message, 'waiting', now() + interval '30 days');

  update profiles set checkin_status = 'waiting', waiting_started_at = now() where id = acc.id;

  return query select 'waiting'::text, acc.name;
end;
$$ language plpgsql security definer;

grant execute on function report_death(text, text, text, text, text, text) to anon, authenticated;
