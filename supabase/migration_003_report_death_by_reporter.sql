-- Migratie 003: report_death opzoeken via reporter-email (geen e-mail overledene meer)
--
-- Wijziging: de melder hoeft het e-mailadres van de overledene bij AfterFile niet te weten.
-- In plaats daarvan zoeken we het account op via de contactenlijst: het account waar de
-- melder staat ingeschreven als vertrouwd contact.
--
-- Nieuwe parameters:
--   p_reporter_name     naam van de melder
--   p_reporter_email    e-mailadres van de melder (= opzoeksleutel via contacts-tabel)
--   p_deceased_name     naam overledene (ter info, voor de admin)
--   p_reporter_phone    optioneel
--   p_message           optioneel
--   p_has_certificate   boolean
--   p_certificate_path  pad naar geüpload bestand
--
-- Verwijderd: p_target_email (e-mailadres overledene)
--
-- Retourneert: result_status, deceased_name, deceased_email, is_new, has_certificate

-- Verwijder alle bestaande overloads van report_death
drop function if exists public.report_death(text, text, text, text, text, text);
drop function if exists public.report_death(text, text, text, text, text, text, boolean, text);
drop function if exists public.report_death(text, text, text, text, text, text, text);

create or replace function public.report_death(
  p_reporter_name     text,
  p_reporter_email    text,
  p_deceased_name     text    default ''::text,
  p_reporter_phone    text    default ''::text,
  p_message           text    default ''::text,
  p_has_certificate   boolean default false,
  p_certificate_path  text    default ''::text
)
returns table(result_status text, deceased_name text, deceased_email text, is_new boolean, has_certificate boolean)
language plpgsql
security definer
as $function$
declare
  acc      profiles;
  existing death_reports;
begin
  -- Zoek het account op via de contactenlijst:
  -- het account dat de melder heeft toegevoegd als vertrouwd contact.
  select p.* into acc
  from profiles p
  inner join contacts c on c.account_id = p.id
  where lower(c.email) = lower(p_reporter_email)
  limit 1;

  if acc.id is null then
    return query select 'not_found'::text, ''::text, ''::text, false, false;
    return;
  end if;

  -- Controleer of er al een melding loopt of al vrijgegeven is
  select * into existing
  from death_reports
  where target_account_id = acc.id
    and status in ('waiting', 'shared')
  order by reported_at desc
  limit 1;

  if existing.id is not null then
    return query select existing.status, acc.name, acc.email, false, existing.has_certificate;
    return;
  end if;

  -- Nieuwe melding aanmaken (geen wachttijd — goedkeuring triggert directe vrijgave)
  insert into death_reports (
    target_email, target_account_id,
    reporter_name, reporter_email, reporter_phone,
    relationship, message, status,
    has_certificate, certificate_path,
    waiting_until
  ) values (
    lower(acc.email), acc.id,
    p_reporter_name, p_reporter_email, p_reporter_phone,
    '', p_message, 'waiting',
    p_has_certificate, p_certificate_path,
    now() + interval '365 days'  -- veiligheidsnet; vrijgave loopt via admin-goedkeuring
  );

  update profiles
  set checkin_status = 'waiting', waiting_started_at = now()
  where id = acc.id;

  return query select 'matched'::text, acc.name, acc.email, true, p_has_certificate;
end;
$function$;

grant execute on function public.report_death(text, text, text, text, text, boolean, text) to anon, authenticated;
alter function public.report_death(text, text, text, text, text, boolean, text) set search_path = public;
