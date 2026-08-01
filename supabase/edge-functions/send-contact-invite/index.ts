// Edge Function: send-contact-invite (v16)
// Aanroep: rechtstreeks vanuit app.js, vlak na het aanmaken van een contact.
// Accepteert optioneel fragment_c uit localStorage van de client.
// Fragment C wordt NOOIT opgeslagen -- alleen transiënt doorgestuurd per e-mail aan contact.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_ADDRESS = "AfterFile <info@afterfile.nl>";
const REPLY_TO = "info@afterfile.nl";

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
<p style="margin:0;font-size:12px;line-height:1.6;color:#9AA1B0;">AfterFile, jouw digitale nalatenschap veilig geregeld.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
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
      .select("name")
      .eq("id", userData.user.id)
      .maybeSingle();
    const ownerName = profile?.name || "Iemand";

    const roles: string[] = contact.roles || [];
    const roleItems: string[] = [];
    if (roles.includes("inform")) {
      roleItems.push(
        `Je ontvangt de door ${escapeHtml(ownerName)} vastgelegde gegevens zodra een overlijden is bevestigd en door AfterFile geverifieerd.`
      );
    }
    if (roles.includes("verify")) {
      roleItems.push(
        `Je kunt, als dat nodig is, een overlijden melden via de pagina "Overlijden melden" op afterfile.nl.`
      );
    }
    const roleHtml = roleItems
      .map((t) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5B6172;">• ${t}</p>`)
      .join("");

    // Fragment C: alleen indien meegegeven door client (uit localStorage)
    // NOOIT opgeslagen in de database -- alleen transiënt doorgestuurd.
    const fragCBlock = fragment_c ? `
      <div style="margin:20px 0;padding:16px 20px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0F1222;">Jouw persoonlijke kluiscode</p>
        <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#5B6172;">
          ${escapeHtml(ownerName)} heeft je ook aangewezen als kluiscontact. Bewaar de onderstaande code veilig --
          je hebt hem nodig als ${escapeHtml(ownerName)} overlijdt en jij de kluisinhoud wilt openen.
        </p>
        <div style="font-family:monospace;font-size:13px;word-break:break-all;color:#1e293b;background:#fff;border:1px dashed #cbd5e1;border-radius:6px;padding:12px 16px;">
          ${escapeHtml(fragment_c)}
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#9AA1B0;">Bewaar deze code in je wachtwoordmanager of druk hem af.</p>
      </div>
    ` : '';

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
        <strong style="color:#0F1222;">${escapeHtml(ownerName)}</strong> heeft je toegevoegd als vertrouwd contact op AfterFile, een dienst voor het veilig vastleggen en overdragen van digitale nalatenschap.
      </p>
      ${roleHtml}
      ${fragCBlock}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#9AA1B0;">
        Heb je hier vragen over? Neem dan rechtstreeks contact op met ${escapeHtml(ownerName)}, of stuur een e-mail naar info@afterfile.nl.
      </p>
    `;

    const plainRoleItems = roleItems.map(t => `• ${t}`).join("\n");
    const bodyText = [
      `${ownerName} heeft je toegevoegd als vertrouwd contact op AfterFile.`,
      `AfterFile is een dienst voor het veilig vastleggen en overdragen van digitale nalatenschap.`,
      ``,
      plainRoleItems,
      fragment_c ? `\nJouw persoonlijke kluiscode:\n${fragment_c}\nBewaar hem veilig in je wachtwoordmanager of op papier.\n` : '',
      `Heb je hier vragen over? Neem dan rechtstreeks contact op met ${ownerName}, of stuur een e-mail naar info@afterfile.nl.`,
      ``,
      `-- AfterFile (afterfile.nl)`,
    ].join("\n");

    await sendEmail(
      contact.email,
      `${ownerName} heeft je toegevoegd als vertrouwd contact op AfterFile`,
      emailShell("Je bent toegevoegd als vertrouwd contact", bodyHtml),
      bodyText
    );

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
