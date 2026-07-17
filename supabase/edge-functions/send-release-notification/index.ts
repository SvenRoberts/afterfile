// Edge Function: send-release-notification
// Aanroep: UITSLUITEND door de dagelijkse pg_cron job (via trigger_release_check() -> pg_net),
// nooit rechtstreeks vanuit de browser. verify_jwt staat UIT, want de aanroeper is geen
// ingelogde gebruiker — in plaats daarvan controleert deze functie zelf de custom header
// "x-cron-secret" tegen de CRON_SECRET Edge Function secret (door Sven handmatig gezet in
// Dashboard -> Edge Functions -> Secrets; moet exact overeenkomen met het secret dat in de
// trigger_release_check()-functie in de database staat).
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FROM_ADDRESS = "AfterFile <noreply@afterfile.nl>"; // pas aan naar je geverifieerde Resend-afzender indien anders

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

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
}

function emailShell(title: string, bodyHtml: string) {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E3E6EC;border-radius:16px;overflow:hidden;">
<tr><td align="center" bgcolor="#2F5DD9" style="background-color:#2F5DD9;background-image:linear-gradient(135deg,#3B6BEB 0%,#7A4DF0 100%);padding:28px 24px;">
<img src="https://afterfile.nl/assets/logo.png" width="36" height="36" alt="AfterFile" style="display:block;width:36px;height:36px;border-radius:8px;border:0;margin:0 auto 6px;" />
<span style="font-size:18px;font-weight:700;color:#FFFFFF;">AfterFile</span>
</td></tr>
<tr><td style="padding:32px 36px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0F1222;font-weight:700;">${title}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:0 36px 28px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9AA1B0;">AfterFile — jouw digitale nalatenschap, veilig geregeld.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
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
      const accountId = item.account_id as string | undefined;
      const deceasedName = (item.deceased_name as string) || "deze persoon";
      if (!accountId) continue;

      const [{ data: profile }, { data: contacts }, { data: assets }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("name, full_name, street, postal_code, city, birth_date, phone, instructions")
          .eq("id", accountId)
          .maybeSingle(),
        supabaseAdmin.from("contacts").select("name, email, roles").eq("account_id", accountId),
        supabaseAdmin.from("assets").select("name, type_label, location, description, notes").eq("account_id", accountId),
      ]);

      const informContacts = ((contacts || []) as Array<Record<string, unknown>>).filter(
        (c) => ((c.roles as string[]) || []).includes("inform") && c.email
      );
      if (informContacts.length === 0) continue;

      const personalLines: string[] = [];
      if (profile?.full_name) personalLines.push(`Volledige naam: ${escapeHtml(profile.full_name as string)}`);
      if (profile?.street || profile?.postal_code || profile?.city) {
        personalLines.push(
          `Adres: ${escapeHtml([profile?.street, profile?.postal_code, profile?.city].filter(Boolean).join(", "))}`
        );
      }
      if (profile?.birth_date) personalLines.push(`Geboortedatum: ${escapeHtml(profile.birth_date as string)}`);
      if (profile?.phone) personalLines.push(`Telefoon: ${escapeHtml(profile.phone as string)}`);
      const personalHtml = personalLines.length
        ? personalLines.map((l) => `<p style="margin:0 0 6px;font-size:14px;color:#5B6172;">${l}</p>`).join("")
        : `<p style="margin:0 0 6px;font-size:14px;color:#9AA1B0;">Geen persoonlijke gegevens vastgelegd.</p>`;

      const instructionsHtml = profile?.instructions
        ? `<p style="margin:0 0 6px;font-size:14px;color:#5B6172;white-space:pre-wrap;">${escapeHtml(profile.instructions as string)}</p>`
        : `<p style="margin:0 0 6px;font-size:14px;color:#9AA1B0;">Geen instructies vastgelegd.</p>`;

      const assetRows = (assets || []) as Array<Record<string, unknown>>;
      const assetsHtml = assetRows.length
        ? assetRows
            .map(
              (a) =>
                `<p style="margin:0 0 10px;font-size:14px;color:#5B6172;">• <strong style="color:#0F1222;">${escapeHtml(
                  (a.name as string) || (a.type_label as string) || "Bezitting"
                )}</strong>${a.location ? ` — ${escapeHtml(a.location as string)}` : ""}${
                  a.notes ? `<br/><span style="color:#9AA1B0;">${escapeHtml(a.notes as string)}</span>` : ""
                }</p>`
            )
            .join("")
        : `<p style="margin:0 0 6px;font-size:14px;color:#9AA1B0;">Geen bezittingen vastgelegd.</p>`;

      const bodyHtml = `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
          Het overlijden van <strong style="color:#0F1222;">${escapeHtml(deceasedName)}</strong> is bevestigd en de wachttijd van 30 dagen is verstreken. Hieronder vind je de gegevens die ${escapeHtml(
            deceasedName
          )} via AfterFile heeft vastgelegd voor jou.
        </p>
        <h3 style="margin:24px 0 8px;font-size:15px;color:#0F1222;">Persoonlijke gegevens</h3>
        ${personalHtml}
        <h3 style="margin:24px 0 8px;font-size:15px;color:#0F1222;">Instructies</h3>
        ${instructionsHtml}
        <h3 style="margin:24px 0 8px;font-size:15px;color:#0F1222;">Bezittingen</h3>
        ${assetsHtml}
      `;

      for (const contact of informContacts) {
        try {
          await sendEmail(
            contact.email as string,
            `Belangrijke informatie van ${deceasedName} via AfterFile`,
            emailShell(`Gegevens van ${escapeHtml(deceasedName)}`, bodyHtml)
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
