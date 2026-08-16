// Edge Function: send-death-report-alert (v5)
// Aanroep: vanuit app.js na een succesvolle report_death()-RPC.
// verify_jwt staat UIT. De functie zoekt zelf de meest recente 'waiting'-melding op
// via de service-role-key en stuurt alleen naar het e-mailadres dat al in profiles staat.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_ADDRESS   = "AfterFile <info@afterfile.nl>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY niet ingesteld");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend-fout (${res.status}): ${await res.text()}`);
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string,string>)[c]);
}

function emailShell(preheader: string, bodyHtml: string, accentColor = "#2F5DD9") {
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
      <td style="background:${accentColor};height:5px;line-height:5px;font-size:5px;">&nbsp;</td>
    </tr>
    <!-- Logo header -->
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
          AfterFile, jouw digitale nalatenschap, veilig geregeld.
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { deceasedEmail, reporterName, relationship } = await req.json();
    if (!deceasedEmail) return json({ ok: false });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: report } = await supabaseAdmin
      .from("death_reports")
      .select("target_account_id, reported_at, status")
      .eq("target_email", String(deceasedEmail).toLowerCase())
      .eq("status", "waiting")
      .order("reported_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report?.target_account_id) return json({ ok: false });

    const ageMs = Date.now() - new Date(report.reported_at as string).getTime();
    if (ageMs > 5 * 60 * 1000) return json({ ok: false });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("id", report.target_account_id as string)
      .maybeSingle();
    if (!profile?.email) return json({ ok: false });

    const reporterDesc = reporterName
      ? `${esc(reporterName)}${relationship ? ` (${esc(relationship)})` : ""}`
      : "een derde";

    const bodyHtml = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Melding voor jouw AfterFile-account</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        Via <a href="https://afterfile.nl" style="color:#2F5DD9;text-decoration:none;">afterfile.nl</a> is een overlijdensmelding ingediend voor jouw account door ${reporterDesc}.
      </p>

      <!-- Waarschuwingsblok -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#FEF3F2;border:1px solid rgba(220,53,69,.2);border-left:3px solid #DC3545;border-radius:6px;padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#7B1422;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Actie vereist als dit niet klopt</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#7B1422;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              Herken jij deze melding niet? Log dan in op je AfterFile-account. De melding wordt daarmee automatisch geannuleerd.
            </p>
          </td>
        </tr>
      </table>

      <!-- Wat er nu gebeurt -->
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Wat er nu gebeurt</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(47,93,217,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;">AfterFile verifieert de melding aan de hand van het ingediende overlijdensbericht.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(47,93,217,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;">Na verificatie en een wachttijd worden de door jou vastgelegde gegevens gedeeld met jouw contacten met de rol &ldquo;Informatie ontvangen&rdquo;.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;">Log je in op je account? Dan wordt de melding direct geannuleerd en gebeurt er niets.</p>
          </td>
        </tr>
      </table>

      <!-- CTA knop -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
        <tr>
          <td align="center" style="background:#2F5DD9;border-radius:8px;">
            <a href="https://afterfile.nl" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              Inloggen op AfterFile &rarr;
            </a>
          </td>
        </tr>
      </table>
    `;

    await sendEmail(
      profile.email,
      "Belangrijk: er is een overlijdensmelding ingediend voor jouw AfterFile-account",
      emailShell("Er is een overlijdensmelding ingediend voor jouw account. Log in om dit te annuleren.", bodyHtml, "#1A2540")
    );

    // Notify admin so Beheer can be checked promptly
    const adminHtml = `<p style="font-family:sans-serif;font-size:14px;color:#333;">
      <strong>Nieuwe overlijdensmelding ontvangen</strong><br><br>
      Account: <strong>${esc(profile.email)}</strong> (${esc(profile.name || 'onbekend')})<br>
      Ingediend door: <strong>${reporterDesc}</strong><br>
      Tijdstip: ${new Date(report.reported_at as string).toLocaleString('nl-NL')}<br><br>
      Controleer <a href="https://afterfile.nl/#view=beheer">Beheer</a> om de melding te verwerken.
    </p>`;
    await sendEmail(
      'info@afterfile.nl',
      `[AfterFile] Overlijdensmelding: ${esc(profile.email)}`,
      adminHtml
    ).catch(e => console.error('Admin notif mislukt:', e));

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false });
  }
});
