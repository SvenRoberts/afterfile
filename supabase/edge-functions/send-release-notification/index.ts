// Edge Function: send-release-notification (v4)
// Aanroep: UITSLUITEND door de dagelijkse pg_cron job via trigger_release_check().
// verify_jwt staat UIT. De custom header "x-cron-secret" beschermt de endpoint.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const CRON_SECRET    = Deno.env.get("CRON_SECRET") || "";
const FROM_ADDRESS   = "AfterFile <info@afterfile.nl>";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
      <td style="background:#0F1222;height:5px;line-height:5px;font-size:5px;">&nbsp;</td>
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

function sectionLabel(label: string) {
  return `<p style="margin:24px 0 8px;font-size:10px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(label)}</p>`;
}

function dataCard(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
<tr>
  <td style="background:#F8FAFF;border:1px solid rgba(47,93,217,.12);border-radius:8px;padding:14px 18px;">
    ${html}
  </td>
</tr>
</table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { released } = await req.json();
    if (!Array.isArray(released) || released.length === 0) return json({ ok: true, sent: 0 });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let sent = 0;
    for (const item of released as Array<Record<string, unknown>>) {
      const accountId    = item.account_id as string | undefined;
      const deceasedName = (item.deceased_name as string) || "deze persoon";
      if (!accountId) continue;

      const [{ data: profile }, { data: contacts }, { data: assets }] = await Promise.all([
        supabaseAdmin.from("profiles").select("name, full_name, street, postal_code, city, birth_date, phone, instructions").eq("id", accountId).maybeSingle(),
        supabaseAdmin.from("contacts").select("name, email, roles").eq("account_id", accountId),
        supabaseAdmin.from("assets").select("name, type_label, location, notes").eq("account_id", accountId),
      ]);

      const informContacts = ((contacts || []) as Array<Record<string, unknown>>).filter(
        (c) => ((c.roles as string[]) || []).includes("inform") && c.email
      );
      if (informContacts.length === 0) continue;

      // Persoonlijke gegevens blokken
      const personalItems: string[] = [];
      if (profile?.full_name) personalItems.push(`<tr><td style="font-size:12px;color:#9AAAC8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:4px 0 1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Volledige naam</td></tr><tr><td style="font-size:14px;color:#0F1222;padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(profile.full_name as string)}</td></tr>`);
      const addrParts = [profile?.street, profile?.postal_code, profile?.city].filter(Boolean);
      if (addrParts.length) personalItems.push(`<tr><td style="font-size:12px;color:#9AAAC8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:4px 0 1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Adres</td></tr><tr><td style="font-size:14px;color:#0F1222;padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(addrParts.join(", "))}</td></tr>`);
      if (profile?.birth_date) personalItems.push(`<tr><td style="font-size:12px;color:#9AAAC8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:4px 0 1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Geboortedatum</td></tr><tr><td style="font-size:14px;color:#0F1222;padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(profile.birth_date as string)}</td></tr>`);
      if (profile?.phone) personalItems.push(`<tr><td style="font-size:12px;color:#9AAAC8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:4px 0 1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Telefoonnummer</td></tr><tr><td style="font-size:14px;color:#0F1222;padding:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(profile.phone as string)}</td></tr>`);

      const personalHtml = personalItems.length
        ? dataCard(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${personalItems.join("")}</table>`)
        : dataCard(`<p style="margin:0;font-size:13px;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Geen persoonlijke gegevens vastgelegd.</p>`);

      const instructionsHtml = profile?.instructions
        ? dataCard(`<p style="margin:0;font-size:13px;line-height:1.7;color:#0F1222;white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(profile.instructions as string)}</p>`)
        : dataCard(`<p style="margin:0;font-size:13px;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Geen instructies vastgelegd.</p>`);

      const assetRows = (assets || []) as Array<Record<string, unknown>>;
      const assetsHtml = assetRows.length
        ? assetRows.map((a) => dataCard(`
            <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#0F1222;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc((a.name as string) || (a.type_label as string) || "Bezitting")}</p>
            ${a.location ? `<p style="margin:0 0 2px;font-size:13px;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Locatie: ${esc(a.location as string)}</p>` : ""}
            ${a.notes ? `<p style="margin:0;font-size:12px;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(a.notes as string)}</p>` : ""}
          `)).join("")
        : dataCard(`<p style="margin:0;font-size:13px;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Geen bezittingen vastgelegd.</p>`);

      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Gegevens van ${esc(deceasedName)}</h1>
        <p style="margin:0 0 0;font-size:15px;line-height:1.7;color:#5B6880;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          Het overlijden van <strong style="color:#0F1222;">${esc(deceasedName)}</strong> is door AfterFile bevestigd en de wachttijd is verstreken. Hieronder vind je de gegevens die ${esc(deceasedName)} heeft vastgelegd.
        </p>

        ${sectionLabel("Persoonlijke gegevens")}
        ${personalHtml}

        ${sectionLabel("Instructies")}
        ${instructionsHtml}

        ${sectionLabel("Bezittingen")}
        ${assetsHtml}

        <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#9AAAC8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          Deze e-mail is automatisch verstuurd door AfterFile omdat je de rol &ldquo;Informatie ontvangen&rdquo; had voor dit account. Vragen? <a href="mailto:info@afterfile.nl" style="color:#2F5DD9;text-decoration:none;">info@afterfile.nl</a>
        </p>
      `;

      for (const contact of informContacts) {
        try {
          await sendEmail(
            contact.email as string,
            `Gegevens van ${deceasedName} — AfterFile`,
            emailShell(`${deceasedName} heeft je via AfterFile gegevens nagelaten. Bekijk ze hieronder.`, bodyHtml)
          );
          sent++;
        } catch (e) {
          console.error("Versturen mislukt naar", contact.email, e);
        }
      }
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
