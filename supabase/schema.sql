-- AfterFile — Supabase schema
-- Plak dit hele bestand in de Supabase SQL Editor (Project > SQL Editor > New query) en
-- klik Run. Dit zet de database klaar voor: accounts, bezittingen, contacten, en de
-- overlijdens-melding-flow. Gebaseerd 1-op-1 op de datavorm die nu in app.js's
-- localStorage-state staat, zodat de overstap zo klein mogelijk is.

-- ---------- profiles: 1 rij per account, gekoppeld aan Supabase Auth ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  plan text not null default 'basis' check (plan in ('basis', 'compleet', 'premium')),
  instructions text not null default '',
  checkin_status text not null default 'active' check (checkin_status in ('active', 'waiting', 'shared')),
  waiting_started_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Eigen profiel lezen" on profiles
  for select using (auth.uid() = id);
create policy "Eigen profiel aanmaken" on profiles
  for insert with check (auth.uid() = id);
create policy "Eigen profiel bijwerken" on profiles
  for update using (auth.uid() = id);

-- Maakt automatisch een profiel-rij aan zodra iemand zich via Supabase Auth registreert,
-- zodat app.js niet zelf met een aparte insert-stap hoeft te werken na signUp().
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- assets: "Mijn bezittingen" ----------
create table assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references profiles(id) on delete cascade,
  category_key text not null,
  type_key text not null,
  type_label text not null default '',
  name text not null default '',
  extra jsonb not null default '{}',
  description text not null default '',
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table assets enable row level security;

create policy "Eigen bezittingen beheren" on assets
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

-- ---------- contacts: vertrouwde contacten ----------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references profiles(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  relationship text not null default '',
  address text not null default '',
  birth_date text not null default '',
  phone text not null default '',
  roles text[] not null default array['inform'],
  created_at timestamptz not null default now()
);

alter table contacts enable row level security;

create policy "Eigen contacten beheren" on contacts
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

-- ---------- death_reports: meldingen door een vertrouwd contact ----------
-- Een melder is zelf NIET ingelogd (die heeft geen AfterFile-account nodig), dus inserten
-- moet kunnen voor de "anon"-rol. Lezen mag alleen de accounthouder zelf, op zijn eigen
-- gematchte rapport, zodra die is gekoppeld.
create table death_reports (
  id uuid primary key default gen_random_uuid(),
  target_email text not null,
  target_account_id uuid references profiles(id) on delete cascade,
  reporter_name text not null default '',
  reporter_email text not null default '',
  status text not null default 'open' check (status in ('open', 'not_found', 'waiting', 'shared')),
  reported_at timestamptz not null default now(),
  waiting_until timestamptz,
  shared_at timestamptz
);

alter table death_reports enable row level security;

create policy "Eigenaar leest eigen melding" on death_reports
  for select using (auth.uid() = target_account_id);

-- Inserten gebeurt niet rechtstreeks door de browser, maar via de functie hieronder
-- (security definer), zodat de matching-logica server-side blijft en een bezoeker nooit
-- zelf target_account_id kan invullen of statussen kan vervalsen.

-- ---------- report_death(): koppelt een melding aan het juiste account ----------
-- Vervangt de huidige client-side matchSignupByDeathEmail()-logica in app.js. Roep dit aan
-- via supabase.rpc('report_death', { p_target_email, p_reporter_name, p_reporter_email }).
create function report_death(p_target_email text, p_reporter_name text, p_reporter_email text)
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

  insert into death_reports (target_email, target_account_id, reporter_name, reporter_email, status, waiting_until)
    values (lower(p_target_email), acc.id, p_reporter_name, p_reporter_email, 'waiting', now() + interval '30 days');

  update profiles set checkin_status = 'waiting', waiting_started_at = now() where id = acc.id;

  return query select 'waiting'::text, acc.name;
end;
$$ language plpgsql security definer;

-- Iedereen (ook niet-ingelogde bezoekers) mag deze functie aanroepen:
grant execute on function report_death(text, text, text) to anon, authenticated;

-- Stopt een lopende wachttijd zodra de accounthouder zelf weer inlogt — dit is hét
-- veiligheidsmechanisme tegen een valse/foutieve melding. Roep aan vanuit app.js direct na
-- een succesvolle login, als checkin_status = 'waiting'.
create function cancel_death_report()
returns void as $$
begin
  update profiles set checkin_status = 'active', waiting_started_at = null where id = auth.uid();
  update death_reports set status = 'open' where target_account_id = auth.uid() and status = 'waiting';
end;
$$ language plpgsql security definer;

grant execute on function cancel_death_report() to authenticated;

-- ---------- dagelijkse cron-taak (later, als Edge Function) ----------
-- Eén keer per dag: zoek death_reports met status='waiting' en waiting_until < now(),
-- zet ze op 'shared', zet het bijbehorende profiel op checkin_status='shared', en stuur via
-- Resend de vastgelegde gegevens naar de contacten met rol 'inform'. Dit hoort in een
-- Supabase Edge Function (met een cron-schedule), niet in deze SQL — die staat in fase 2
-- van LANCEERPLAN.md.
