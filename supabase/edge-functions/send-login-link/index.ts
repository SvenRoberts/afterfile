import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')            ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY')          ?? '';
const SITE_URL              = Deno.env.get('SITE_URL')                ?? 'https://afterfile.nl';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Altijd hetzelfde neutrale antwoord teruggeven, ongeacht of het adres bestaat.
// Zo lekt de functie geen informatie over welke e-mails geregistreerd zijn.
const OK = new Response(JSON.stringify({ ok: true }), {
  headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { email } = await req.json();
    const normalized = (email || '').trim().toLowerCase();

    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      // Ongeldige invoer: ook hier generiek antwoord, geen foutdetail
      return OK;
    }

    // Controleer of er een profiel bestaat voor dit adres.
    // Bestaat het niet: doe niets en return OK (geen e-mail sturen, geen account aanmaken).
    // Zo is de functie niet te misbruiken om nep-accounts aan te maken of
    // om te achterhalen welke e-mails geregistreerd zijn.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();

    if (!profile) {
      console.log(`send-login-link: onbekend adres ${normalized}, geen mail verstuurd.`);
      return OK;
    }

    // Gebruiker bestaat: genereer magic link en stuur mail.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalized,
      options: { redirectTo: SITE_URL },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink mislukt:', linkErr?.message);
      return OK; // ook bij fout generiek antwoord
    }

    const hashedToken = linkData.properties.hashed_token;
    const loginUrl = `${SITE_URL}?login=${encodeURIComponent(hashedToken)}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'AfterFile <info@afterfile.nl>',
        to:      [normalized],
        subject: 'Jouw inloglink voor AfterFile',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:24px">AfterFile</div>
            <h2 style="margin:0 0 8px;color:#0f172a">Inloggen bij AfterFile</h2>
            <p style="color:#555;margin:0 0 24px">Klik op de knop hieronder om in te loggen. Er is geen wachtwoord nodig.</p>
            <a href="${loginUrl}" style="display:inline-block;background:#2F5DD9;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Inloggen bij AfterFile</a>
            <p style="color:#888;font-size:13px;margin-top:32px">Heb jij dit niet aangevraagd? Dan kun je deze e-mail negeren.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
            <p style="color:#aaa;font-size:12px">AfterFile BV</p>
          </div>
        `,
      }),
    });

    return OK;
  } catch (e: unknown) {
    console.error('send-login-link fout:', e instanceof Error ? e.message : String(e));
    return OK; // ook bij onverwachte fout generiek antwoord
  }
});
