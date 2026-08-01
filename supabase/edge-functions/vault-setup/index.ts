import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function emailShell(title: string, bodyHtml: string, accent = '#2F5DD9') {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E3E6EC;border-radius:16px;overflow:hidden;">
<tr><td align="center" bgcolor="${accent}" style="background-color:${accent};background-image:linear-gradient(135deg,#3B6BEB 0%,#7A4DF0 100%);padding:28px 24px;">
<img src="https://afterfile.nl/assets/logo.png" width="36" height="36" alt="AfterFile" style="display:block;width:36px;height:36px;border-radius:8px;border:0;margin:0 auto 6px;" />
<span style="font-size:18px;font-weight:700;color:#FFFFFF;">AfterFile</span>
</td></tr>
<tr><td style="padding:32px 36px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0F1222;font-weight:700;">${title}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:0 36px 28px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9AA1B0;">AfterFile, jouw digitale nalatenschap veilig geregeld.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

// v8: Vault setup zonder contactpersoon. Fragment B → gebruiker (herstelcode).
// Fragment C wordt opgeslagen in de browser (localStorage) en per contact verstuurd
// via de send-contact-invite Edge Function wanneer de gebruiker een contact toevoegt.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { fragment_b, encrypted_blob, user_name } = await req.json();
  if (!fragment_b || !encrypted_blob) {
    return new Response('Missing fields', { status: 400, headers: corsHeaders });
  }

  // Eerst controleren of er al een kluis bestaat — één kluis per gebruiker, nooit overschrijven.
  const { data: existing } = await supabase
    .from('vault_data').select('user_id').eq('user_id', user.id).maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ error: 'vault_already_exists' }), {
      status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const { data: vaultRow, error: dbErr } = await supabase
    .from('vault_data')
    .insert({ user_id: user.id, fragment_b, encrypted_blob, contact_email: '' })
    .select('claim_token')
    .single();

  if (dbErr) {
    console.error('DB error:', dbErr);
    return new Response('DB error', { status: 500, headers: corsHeaders });
  }

  const claimToken = vaultRow.claim_token;
  const displayName = user_name || 'je';

  // E-mail → gebruiker: Fragment B als off-device herstelcode
  const userBody = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
      De AfterFile-kluis van <strong style="color:#0F1222;">${displayName}</strong> is aangemaakt.
      Bewaar onderstaande herstelcode op een veilige plek,
      zodat je ook op een nieuw apparaat toegang kunt krijgen tot je kluis.
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#5B6172;">Bewaar deze code in je wachtwoordmanager of druk hem af en leg hem apart:</p>
    <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px 24px;margin:16px 0;font-family:monospace;font-size:14px;word-break:break-all;color:#1e293b;">
      ${fragment_b}
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#9AA1B0;">
      Dit is een back-up van je kluissleutel. Bewaar hem apart van je apparaat.
      Heb je vragen? Stuur een e-mail naar info@afterfile.nl.
    </p>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'AfterFile <noreply@afterfile.nl>',
      to: user.email!,
      subject: 'Jouw AfterFile-kluisherstelcode',
      html: emailShell('Jouw kluisherstelcode', userBody)
    })
  });

  return new Response(JSON.stringify({ ok: true, claim_token: claimToken }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
});
