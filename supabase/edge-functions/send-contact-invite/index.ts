// Edge Function: send-contact-invite (v17)
// Aanroep: rechtstreeks vanuit app.js, vlak na het aanmaken van een contact.
// Fragment C wordt NOOIT opgeslagen -- alleen transiënt doorgestuurd per e-mail aan contact.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_ADDRESS   = "AfterFile <info@afterfile.nl>";
const REPLY_TO       = "info@afterfile.nl";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY niet ingesteld");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, reply_to: REPLY_TO, to, subject, html, text }),
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
<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFF4FF;">
<tr><td align="center" style="padding:40px 16px 48px;">

  <!-- kaart -->
  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;border:1px solid rgba(47,93,217,.15);overflow:hidden;">

    <!-- header balk -->
    <!-- Accent bar -->
    <tr>
      <td style="background:${accentColor};height:5px;line-height:5px;font-size:5px;">&nbsp;</td>
    </tr>
    <!-- Logo header -->
    <tr>
      <td style="background:#ffffff;padding:20px 32px 18px;border-bottom:1px solid rgba(47,93,217,.1);">
        <img src="https://afterfile.nl/assets/logo.png" width="36" height="36" alt="AfterFile" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;margin-right:10px;" /><span style="font-size:18px;font-weight:700;color:#0F1222;vertical-align:middle;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">AfterFile</span>
      </td>
    </tr>

    <!-- body -->
    <tr>
      <td style="padding:36px 40px 28px;">
        ${bodyHtml}
      </td>
    </tr>

    <!-- divider -->
    <tr>
      <td style="padding:0 40px;">
        <div style="height:1px;background:rgba(47,93,217,.1);"></div>
      </td>
    </tr>

    <!-- footer -->
    <tr>
      <td style="padding:20px 40px 28px;">
        <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          AfterFile &mdash; jouw digitale nalatenschap, veilig geregeld.
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#B8C4D8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          Vragen? Stuur een e-mail naar <a href="mailto:info@afterfile.nl" style="color:#2F5DD9;text-decoration:none;">info@afterfile.nl</a>
        </p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

function infoBlock(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr>
  <td style="background:#EFF4FF;border:1px solid rgba(47,93,217,.2);border-left:3px solid #2F5DD9;border-radius:6px;padding:16px 20px;">
    ${html}
  </td>
</tr>
</table>`;
}

function codeBlock(code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;">
<tr>
  <td style="background:#F8FAFF;border:1px dashed rgba(47,93,217,.3);border-radius:8px;padding:16px 20px;">
    <span style="font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.6;color:#0F1222;word-break:break-all;">${esc(code)}</span>
  </td>
</tr>
</table>`;
}

function sectionDivider(label: string) {
  return `<p style="margin:28px 0 10px;font-size:10px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(label)}</p>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const { contactId, fragment_c } = body;
    if (!contactId) return json({ error: "contactId ontbreekt" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Niet ingelogd" }, 401);

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, name, email, roles")
      .eq("id", contactId)
      .maybeSingle();
    if (contactError || !contact) return json({ error: "Contact niet gevonden" }, 404);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    const ownerName = profile?.full_name || userData.user.email || "Iemand";

    const roles: string[] = contact.roles || [];

    // Rol-omschrijvingen
    const roleRows: string[] = [];
    if (roles.includes("inform")) {
      roleRows.push(`
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(47,93,217,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#0F1222;">Informatie ontvangen</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;">Zodra een overlijden is bevestigd en door AfterFile geverifieerd, ontvang je de gegevens die ${esc(ownerName)} heeft vastgelegd.</p>
          </td>
        </tr>`);
    }
    if (roles.includes("verify")) {
      roleRows.push(`
        <tr>
          <td style="padding:10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#0F1222;">Helpen bevestigen</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;">Je kunt een overlijden melden via <a href="https://afterfile.nl" style="color:#2F5DD9;text-decoration:none;">afterfile.nl</a> &mdash; vul de naam en het e-mailadres van ${esc(ownerName)} in, samen met je eigen gegevens ter verificatie.</p>
          </td>
        </tr>`);
    }

    const rolesTable = roleRows.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
        ${roleRows.join("")}
      </table>` : "";

    const fragCBlock = fragment_c ? `
      ${sectionDivider("Persoonlijke kluiscode")}
      ${infoBlock(`<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0F1222;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Bewaar deze code veilig</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(ownerName)} heeft je aangewezen als kluiscontact. Dit is jouw deel van de versleutelde kluis. Je hebt hem nodig als ${esc(ownerName)} overlijdt en jij toegang wilt verlenen tot de kluisinhoud.</p>`)}
      ${codeBlock(fragment_c)}
      <p style="margin:4px 0 0;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Sla deze code op in je wachtwoordmanager of druk hem af. Als het zover is, ga je naar <a href="https://afterfile.nl" style="color:#2F5DD9;text-decoration:none;">afterfile.nl</a> en voer je deze code in op de kluis-pagina van ${esc(ownerName)}.</p>
    ` : "";

    const bodyHtml = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Je bent toegevoegd als vertrouwd contact</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <strong style="color:#0F1222;">${esc(ownerName)}</strong> heeft je toegevoegd als vertrouwd contact op AfterFile &mdash; een dienst waarmee mensen hun digitale nalatenschap veilig kunnen vastleggen en overdragen.
      </p>

      ${sectionDivider("Jouw rollen")}
      ${rolesTable}
      ${fragCBlock}

      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        Heb je vragen? Neem rechtstreeks contact op met ${esc(ownerName)}, of stuur een e-mail naar <a href="mailto:info@afterfile.nl" style="color:#2F5DD9;text-decoration:none;">info@afterfile.nl</a>.
      </p>
    `;

    const plainRoles: string[] = [];
    if (roles.includes("inform")) plainRoles.push("- Informatie ontvangen: zodra een overlijden is bevestigd, ontvang je de vastgelegde gegevens.");
    if (roles.includes("verify")) plainRoles.push("- Helpen bevestigen: je kunt een overlijden melden via afterfile.nl.");
    const bodyText = [
      `Je bent toegevoegd als vertrouwd contact`,
      ``,
      `${ownerName} heeft je toegevoegd als vertrouwd contact op AfterFile (afterfile.nl).`,
      `AfterFile is een dienst waarmee mensen hun digitale nalatenschap veilig vastleggen en overdragen.`,
      ``,
      `Jouw rollen:`,
      ...plainRoles,
      fragment_c ? `\nJouw persoonlijke kluiscode:\n${fragment_c}\n\nBewaar hem veilig in je wachtwoordmanager of op papier.` : "",
      ``,
      `Vragen? Stuur een e-mail naar info@afterfile.nl`,
      `AfterFile — afterfile.nl`,
    ].filter(l => l !== undefined).join("\n");

    await sendEmail(
      contact.email,
      `${ownerName} heeft je toegevoegd als vertrouwd contact`,
      emailShell(`${ownerName} heeft je toegevoegd als vertrouwd contact op AfterFile.`, bodyHtml),
      bodyText
    );

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
