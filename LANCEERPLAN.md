# AfterFile — Lanceerplan: van wachtlijst naar echt werkend concept

## Het kernprobleem

AfterFile is nu 100% client-side: alle data leeft alleen in `localStorage` van de browser van de bezoeker zelf. Er is geen gedeelde server. Dat is de reden dat een wachtlijst-aanmelding niet in jouw Beheer-scherm verschijnt (inmiddels opgelost via Netlify Forms), maar het raakt ook de kernfunctie van het hele product: een vertrouwd contact dat een overlijden meldt, doet dat vanaf een ándere browser/ander apparaat dan de accounthouder. Zonder gedeelde backend kan die melding nooit bij het juiste account terechtkomen. Dit is dus geen nice-to-have — het is de eerste blokkade die weg moet voordat AfterFile "echt" kan werken, voor iedereen, ook gratis.

De goede kant: de productlogica staat al goed beschreven in de copy (rol "Helpen bevestigen" kan melden, daarna 30 dagen wachttijd waarin jij kunt ingrijpen door in te loggen, pas daarna krijgt "Informatie ontvangen" toegang). Fase 2 hieronder is dus vooral: deze bestaande flow echt laten werken, niet opnieuw ontwerpen.

## Gekozen aanpak

- **Backend: Supabase** — gratis te starten (500 MB database, 50.000 actieve gebruikers, onbeperkte API-requests op het gratis plan), bevat database + login (Auth) + achtergrondtaken (Edge Functions) + bestandsopslag in één, en is met simpele JavaScript te koppelen aan de bestaande statische site (geen framework-rewrite nodig). Nadeel gratis tier: projecten pauzeren na een week zonder verkeer, geen backups/SLA — prima om mee te lanceren, maar zodra er omzet is wil je naar de Pro-laag (~$25/maand) voor stabiliteit.
- **E-mail: Resend** — gratis tier van 3.000 e-mails/maand (max. 100/dag), ruim voldoende om mee te starten. Nodig voor: uitnodigingsmail aan vertrouwd contact, bevestiging van een overlijdensmelding, en het bericht na de wachttijd.
- **Betalen: Stripe (niet Mollie)** — je gaf aan dat Mollie je heeft geweigerd. Stripe is de voor de hand liggende vervanger: ondersteunt iDEAL én automatische SEPA-incasso voor terugkerende betalingen, geen vaste maand- of opstartkosten, alleen kosten per gelukte transactie (richtprijs €0,20–€0,50 voor iDEAL/SEPA-incasso). Let op: bij het aanmaken van een Stripe-account wordt ook beoordeeld wat voor bedrijf je bent — wees vooraf duidelijk over wat AfterFile doet, voor het geval risico-beoordeling daar ook gevoelig op reageert. **Plan B** als Stripe ook moeilijk doet: Paddle of Lemon Squeezy. Dat zijn "merchant of record"-partijen die de juridische verkooprol (en het betaalrisico) van je overnemen, tegen een hogere fee (~5% + €0,50 per transactie i.p.v. Stripe's kleine vaste fee), maar met soepelere acceptatie voor dit type bedrijf.
- **Juridische entiteit: Boxfi** — je hebt hier al een KVK-registratie voor. Gebruiken we voor de privacyverklaring/voorwaarden en voor het aanmaken van het Stripe-account.
- **Domein**: een eigen domein (bv. afterfile.nl) i.p.v. afterfile.netlify.app — schept vertrouwen, kan los van de rest geregeld worden.

## Verdeling: wat jij moet doen, wat ik kan bouwen

Ik mag geen accounts voor je aanmaken of inloggegevens invoeren — dat moet jij zelf doen. Zodra je een account hebt en de API-sleutels met me deelt, kan ik de techniek erachter bouwen.

**Jij**: Supabase-, Resend- en Stripe-account aanmaken, Boxfi's KVK-nummer/IBAN invullen waar gevraagd, domeinnaam registreren en DNS koppelen, API-sleutels aanleveren.
**Ik**: de code-integratie in app.js/index.html, database-structuur, e-mailsjablonen, betaalkoppeling, testen.

## Fase 0 — Accounts & juridisch (start dit nu, deels wachttijd door derden)

1. ✅ Domeinnaam geregistreerd en via DNS gekoppeld aan Netlify.
2. ✅ Netlify Forms werkt (wachtlijst komt nu echt binnen).
3. ✅ Stripe-account beschikbaar voor Boxfi, met tegoed.
4. ✅ Supabase-project aangemaakt, Project URL + anon/public key aangeleverd en verwerkt in de code. Auth staat op inlogmethode "Email" (magic link/OTP, geen wachtwoord) — past bij de aanpak hieronder.
   ⏳ **Volgende actie (bij jou):** Resend-account nog aanmaken (zie uitleg verderop in dit gesprek) — nodig voor Fase 2, nog niet voor wat nu al werkt.
5. Privacyverklaring + algemene voorwaarden laten opstellen met Boxfi als verwerkingsverantwoordelijke. Gezien de gevoeligheid van de data (wachtwoorden, financiële bezittingen, instructies na overlijden) raad ik aan hier een jurist op te laten meekijken voordat je breed live gaat — ik kan een eerste versie schrijven, maar dit is geen vervanging voor juridisch advies.

## Fase 1 — Echte backend: accounts + opslag

5. ✅ `localStorage`-laag in app.js vervangen door Supabase Auth (magic link via e-mail, geen wachtwoord) en Supabase-tabellen voor profiel, bezittingen, contacten, persoonsgegevens en instructies, met Row Level Security zodat iedereen alleen zijn eigen gegevens ziet. Migratie `supabase/migration_001_personal_info.sql` toegevoegd voor de ontbrekende kolommen (persoonsgegevens + meldervelden) — **moet jij nog draaien in de Supabase SQL Editor**, zie rapportage.
6. ✅ Bestaande functies omgezet naar Supabase-aanroepen: account aanmaken/inloggen, bezittingen, contacten, persoonsgegevens en instructies lezen/schrijven gaan nu allemaal via Supabase i.p.v. `localStorage`. Gevalideerd met een los testscript (17/17 checks geslaagd).
   ⏳ **Nog niet gemigreerd (bewuste keuze, niet vergeten):** de Beheer-pagina en de "meld een overlijden"-demoflow draaien nog op de oude lokale opslag (nu `afterfile_demo_extra_v1`) en zijn dus nog single-browser. Dit is Fase 2.

## Fase 2 — De overlijdens-melding-flow écht maken (kernfunctie) — ✅ volledig klaar

7. ✅ Centrale opslag voor meldingen door vertrouwde contacten: `report_death()`/`cancel_death_report()` RPC's live in Supabase, en echt aangesloten in app.js (niet meer gesimuleerd). Geverifieerd met live testaanroepen: nieuwe melding, dubbele melding (blijft "wachttijd loopt al"), onbekend e-mailadres ("niet gevonden"), en het verstrijken van de wachttijd (zet automatisch om naar "gedeeld") — allemaal correct, testdata weer opgeruimd.
8. ✅ Resend gekoppeld via drie Edge Functions, alle drie live (`ACTIVE`): uitnodigingsmail bij nieuw contact, waarschuwing aan de accounthouder bij een nieuwe melding (met uitleg dat opnieuw inloggen de melding annuleert), en het bericht met de vastgelegde gegevens aan de contacten met rol "Informatie ontvangen" na afloop van de wachttijd.
9. ✅ Achtergrondtaak staat: een dagelijkse Supabase-cronjob (05:00 UTC) controleert verlopen wachttijden en roept de release-mail-functie aan. Logica geverifieerd door de wachttijd van een testmelding kunstmatig te laten verlopen — de omzetting naar "gedeeld" werkte direct.
   ✅ `RESEND_API_KEY` en `CRON_SECRET` zijn ingesteld bij Supabase Dashboard → Edge Functions → Secrets. Opnieuw getest met dezelfde methode als eerder (testmelding, wachttijd kunstmatig laten verlopen, release-check getriggerd): de Edge Function gaf nu `200 OK` terug in plaats van de eerdere `401 Unauthorized`, en de melding werd correct omgezet naar "gedeeld". Testdata weer opgeruimd.
   ✅ Afzenderadres `noreply@afterfile.nl` bevestigd door Sven als overeenkomend met de geverifieerde Resend-afzender.

## Fase 3 — Betalen

10. ✅ Stripe Checkout gekoppeld aan de Compleet/Premium-knoppen. Twee Edge Functions zijn live: `create-checkout-session` (maakt een Checkout Session, `mode: 'subscription'`, en stuurt door naar Stripe) en `stripe-webhook` (verwerkt het resultaat). In app.js: het gekozen plan reist mee bij de aanmelding (magic-link metadata), na inloggen wordt automatisch de Stripe Checkout gestart voor een betaald plan, en de Dashboard-pagina heeft een "upgrade"-knop voor bestaande Basis-accounts. Het betaalstapje in het aanmeldformulier legt nu echt uit wat er gebeurt (proefperiode, daarna automatische SEPA-incasso) in plaats van de oude demo-tekst.
11. ✅ Webhook-code staat klaar om na succesvolle betaling het abonnement in Supabase te activeren (`checkout.session.completed`, plus updates/opzeggingen via `customer.subscription.updated`/`.deleted` en mislukte incasso via `invoice.payment_failed`). **Nog niet live getest** — zie de checklist hieronder, dat moet jij activeren en de eerste keer zelf doorlopen.
12. ⏳ `PRELAUNCH_MODE` blijft aan totdat jij de checklist hieronder hebt doorlopen en een eerste succesvolle betaling hebt gezien.

### Wat jij nog moet doen voordat dit echt werkt

**Eerst testen met €1, daarna pas de echte prijzen**

1. **Stripe Dashboard → Settings → Payment methods**: iDEAL en SEPA Direct Debit aanzetten (recurring/herhaalde betalingen).
2. **Stripe Dashboard → Product catalog**: maak twee *tijdelijke testprijzen* aan van €1,00/jaar (recurring, interval "year") — één voor Compleet, één voor Premium. Onthoud de twee Price-ID's (`price_...`).
3. **Supabase Dashboard → Edge Functions → Secrets**: vier secrets instellen — `STRIPE_SECRET_KEY` (je live secret key), `STRIPE_WEBHOOK_SECRET` (zie stap 4), `STRIPE_PRICE_COMPLEET` en `STRIPE_PRICE_PREMIUM` (de twee €1-test-Price-ID's uit stap 2).
4. **Stripe Dashboard → Developers → Webhooks**: nieuw endpoint toevoegen naar `https://prkwfuiadjfpdmcorfas.supabase.co/functions/v1/stripe-webhook`, met events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Kopieer de signing secret die je daarbij krijgt naar `STRIPE_WEBHOOK_SECRET` (stap 3).
5. **Eerste test zelf doorlopen, voor €1**: log in op afterfile.nl met je eigen (eigenaars-)e-mailadres — dat gaat altijd direct door naar het Dashboard, ook met `PRELAUNCH_MODE` aan. Klik daar op de nieuwe "upgrade naar betaald plan"-knop en doorloop de Stripe Checkout met een echte iDEAL-betaling van €1. Dit kan ik niet voor je doen; betaalgegevens invoeren moet jij zelf doen.
6. **Controleren**: na de test moet in Supabase (tabel `profiles`) je `stripe_customer_id` en plan-status zijn bijgewerkt. Even melden of dat klopt.
7. **Pas dan de echte prijzen instellen**: zodra de test goed gaat, maak je in Stripe twee nieuwe recurring Price objects aan voor de definitieve bedragen (Compleet €89/jaar, Premium €189/jaar) en vervang je de waarden van `STRIPE_PRICE_COMPLEET`/`STRIPE_PRICE_PREMIUM` in Supabase door die nieuwe Price-ID's. (De €1-testprijzen mag je daarna laten staan of archiveren in Stripe, ze worden niet meer gebruikt.)
8. **Terugkoppelen**: laat het weten zodra de échte prijzen erin staan, dan zet ik `PRELAUNCH_MODE` uit.

### Opgelost
PayPal is verwijderd uit alle copy (FAQ, betaalmethoden-rij op de landingspagina, en de interne lijst met betaalmethoden) — de site noemt nu alleen nog iDEAL, Visa en Mastercard, in lijn met wat de Checkout-koppeling echt ondersteunt.

De `netlify/`-map (jouw daadwerkelijke deploy-bundel) liep flink achter op de root-bestanden: hij miste de hele Stripe Checkout-koppeling, de Supabase RPC-flow voor overlijden melden, de Resend-e-mails en de dagelijkse cron-release, en had ook nog PayPal in de copy staan. `netlify/app.js` en `netlify/styles.css` zijn nu volledig gelijkgetrokken met de root-versie. **Belangrijk:** dit is alleen op deze computer aangepast — jij moet deze twee bestanden zelf opnieuw naar Netlify kopiëren/uploaden en redeployen voordat de Stripe Checkout-koppeling (en dus de €1-test hierboven) op afterfile.nl werkt.

## Fase 4 — Testen & soft launch

13. Volledige end-to-end test als "vreemde": account aanmaken, betalen, contact toevoegen, overlijden melden vanaf een ander apparaat/browser, wachttijd doorlopen.
14. Soft launch naar de bestaande wachtlijst-aanmelders vóór een brede aankondiging.

## Realistische verwachting

Dit is een echte backend-bouw, geen tekstuele aanpassing zoals de vorige rondes. Reken op meerdere werksessies, vooral omdat stap 1-3 (accountverificaties bij Stripe/Supabase) buiten onze controle liggen qua wachttijd. Zodra jij de accounts hebt aangemaakt en de eerste sleutels deelt, kan ik direct door met de code.
