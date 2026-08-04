// Edge Function: vault-setup (v9)
// Slaat de versleutelde blob + fragment B op in vault_data.
// Stuurt fragment B per e-mail aan de eigenaar als off-device herstelcode.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string,string>)[c]);
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
    <!-- Accent bar -->
    <tr>
      <td style="background:#2F5DD9;height:5px;line-height:5px;font-size:5px;">&nbsp;</td>
    </tr>
    <!-- Logo header -->
    <tr>
      <td style="background:#ffffff;padding:20px 32px 18px;border-bottom:1px solid rgba(47,93,217,.1);">
        <img src="https://afterfile.nl/assets/logo.png" width="36" height="36" alt="AfterFile" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;margin-right:10px;" /><span style="font-size:18px;font-weight:700;color:#0F1222;vertical-align:middle;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">AfterFile</span>
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { fragment_b, encrypted_blob, user_name } = await req.json();
  if (!fragment_b || !encrypted_blob) {
    return new Response('Missing fields', { status: 400, headers: corsHeaders });
  }

  // Één kluis per gebruiker — nooit overschrijven.
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

  const claimToken  = vaultRow.claim_token;
  const displayName = user_name || 'je';

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Jouw kluisherstelcode</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      De AfterFile-kluis van <strong style="color:#0F1222;">${esc(displayName)}</strong> is aangemaakt. Bewaar de onderstaande herstelcode op een veilige plek, los van dit apparaat &mdash; je hebt hem nodig om op een nieuw apparaat opnieuw toegang te krijgen.
    </p>

    <!-- Code blok -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background:#F8FAFF;border:1px dashed rgba(47,93,217,.35);border-radius:8px;padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Herstelcode</p>
          <span style="font-family:'Courier New',Courier,monospace;font-size:14px;line-height:1.6;color:#0F1222;word-break:break-all;">${esc(fragment_b)}</span>
        </td>
      </tr>
    </table>

    <!-- Info blok -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#EFF4FF;border:1px solid rgba(47,93,217,.2);border-left:3px solid #2F5DD9;border-radius:6px;padding:14px 18px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#0F1222;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Hoe bewaar je deze code?</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            Sla hem op in je wachtwoordmanager, druk hem af en bewaar hem op een veilige plek, of noteer hem in een notitieboek dat je apart bewaart van dit apparaat.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      AfterFile slaat deze code <strong>niet</strong> op. Verlies je hem, dan kun je alleen nog via je contactpersonen opnieuw toegang krijgen.
    </p>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'AfterFile <info@afterfile.nl>',
      to: user.email!,
      subject: 'Jouw AfterFile-kluisherstelcode — bewaar hem veilig',
      html: emailShell('Jouw kluisherstelcode staat hieronder. Bewaar hem op een veilige plek, los van dit apparaat.', bodyHtml)
    })
  });

  return new Response(JSON.stringify({ ok: true, claim_token: claimToken }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
});
