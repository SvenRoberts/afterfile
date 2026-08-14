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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Ongeldig e-mailadres.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim(),
      options: { redirectTo: SITE_URL },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink mislukt:', linkErr?.message);
      return new Response(JSON.stringify({ error: 'Kon geen inloglink aanmaken.' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const hashedToken = linkData.properties.hashed_token;
    const loginUrl = `${SITE_URL}?login=${encodeURIComponent(hashedToken)}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'AfterFile <info@afterfile.nl>',
        to:      [email],
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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
