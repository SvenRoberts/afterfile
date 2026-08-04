// Edge Function: send-vault-access (v1)
// Aanroep: door de admin-handler in app.js direct na het goedkeuren van een overlijdensmelding.
// Stuurt de kluiscontact een e-mail met hun persoonlijke toegangslink (Fragment C + link).
// Vereist: service-role access om vault_data te lezen.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL         = 'https://afterfile.nl';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string,string>)[c]);
}

function emailShell(preheader: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>AfterFile</title>
</head>
<body style="margin:0;padding:0;background:#EFF4FF;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFF4FF;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;border:1px solid rgba(47,93,217,.15);overflow:hidden;">
    <tr>
      <td style="background:#2F5DD9;height:5px;line-height:5px;font-size:5px;">&nbsp;</td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:20px 32px 18px;border-bottom:1px solid rgba(47,93,217,.1);">
        <img src="https://afterfile.nl/assets/logo.png" width="36" height="36" alt="AfterFile" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;margin-right:10px;" /><span style="font-size:18px;font-weight:700;color:#0F1222;vertical-align:middle;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">AfterFile</span>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px 28px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <div style="height:1px;background:rgba(47,93,217,.1);"></div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 28px;">
        <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          AfterFile &mdash; jouw digitale nalatenschap, veilig geregeld.
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#B8C4D8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          Vragen? <a href="mailto:info@afterfile.nl" style="color:#2F5DD9;text-decoration:none;">info@afterfile.nl</a>
        </p>
      </td>
    </tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  // Verifieer de aanroeper (moet een ingelogde admin zijn)
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { accountId, deceasedName } = await req.json();
  if (!accountId) return new Response(JSON.stringify({ error: 'accountId ontbreekt' }), { status: 400, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Haal vault_data op voor dit account
  const { data: vault, error: vaultErr } = await supabase
    .from('vault_data')
    .select('claim_token, contact_email')
    .eq('user_id', accountId)
    .maybeSingle();

  if (vaultErr || !vault) {
    console.log('Geen vault_data gevonden voor account', accountId);
    return new Response(JSON.stringify({ ok: true, skipped: 'no_vault' }), { headers: corsHeaders });
  }

  const { claim_token, contact_email } = vault;

  if (!contact_email || !claim_token) {
    console.log('Kluiscontact e-mail of token ontbreekt, geen e-mail verstuurd');
    return new Response(JSON.stringify({ ok: true, skipped: 'no_contact_email' }), { headers: corsHeaders });
  }

  const claimUrl = `${SITE_URL}/#view=death-report?token=${encodeURIComponent(claim_token)}`;
  const deceased = deceasedName || 'de overledene';

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Kluistoegang beschikbaar</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Het overlijden van <strong style="color:#0F1222;">${esc(deceased)}</strong> is door AfterFile bevestigd. Je kunt nu de kluis openen met jouw persoonlijke code.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#EFF4FF;border:1px solid rgba(47,93,217,.2);border-left:3px solid #2F5DD9;border-radius:6px;padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Wat je nodig hebt</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            Jouw persoonlijke code (Fragment C) &mdash; die heb je eerder ontvangen toen je als kluiscontact werd aangewezen. Klik op de knop hieronder en voer de code in om toegang te krijgen.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:#2F5DD9;border-radius:8px;padding:0;">
          <a href="${claimUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:-.1px;">
            Kluis openen &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Werkt de knop niet? Kopieer dan deze link naar je browser:
    </p>
    <p style="margin:0;font-size:11px;line-height:1.6;color:#9AAAC8;word-break:break-all;font-family:'Courier New',Courier,monospace;">
      ${esc(claimUrl)}
    </p>

    <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      Je ontvangt dit bericht omdat je was aangewezen als kluiscontact. Vragen? <a href="mailto:info@afterfile.nl" style="color:#2F5DD9;text-decoration:none;">info@afterfile.nl</a>
    </p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'AfterFile <info@afterfile.nl>',
      to: contact_email,
      subject: `Kluistoegang beschikbaar &mdash; ${esc(deceased)}`,
      html: emailShell(`De kluis van ${deceased} is nu toegankelijk. Gebruik jouw persoonlijke code om hem te openen.`, bodyHtml),
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend fout:', err);
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, sent_to: contact_email }), { headers: corsHeaders });
});
