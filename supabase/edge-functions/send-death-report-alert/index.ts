// Edge Function: send-death-report-alert
// Aanroep: rechtstreeks vanuit app.js, vlak na een succesvolle (nieuwe) report_death()-RPC,
// door de anonieme melder. verify_jwt staat UIT (er is geen ingelogde gebruiker — de melder is
// per definitie niet de accounteigenaar). Omdat dit dus door iedereen aanroepbaar is, vertrouwt
// de functie niets wat de aanroeper beweert: ze zoekt zelf, met de service-role-key, de meest
// recente 'waiting'-death_report op voor het opgegeven e-mailadres, stuurt alleen naar het
// e-mailadres dat al in profiles staat (nooit naar een door de aanroeper opgegeven adres), en
// doet dit alleen als die melding hooguit 5 minuten oud is — zodat deze functie niet los van een
// echte report_death()-aanroep te misbruiken is.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
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

function emailShell(title: string, bodyHtml: string, accent = "#C0392B") {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E3E6EC;border-radius:16px;overflow:hidden;">
<tr><td align="center" bgcolor="${accent}" style="background-color:${accent};padding:28px 24px;">
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

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
        Iemand heeft via afterfile.nl een overlijden gemeld voor jouw account${
          reporterName ? ` (melder: <strong style="color:#0F1222;">${escapeHtml(reporterName)}</strong>${relationship ? `, ${escapeHtml(relationship)}` : ""})` : ""
        }.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
        Is dit niet juist? Log dan binnen 30 dagen in op je AfterFile-account. Daarmee wordt deze melding automatisch geannuleerd.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5B6172;">
        Doe je dit niet, dan worden de door jou vastgelegde gegevens na de wachttijd gedeeld met de contacten die jij de rol "Informatie ontvangen" hebt gegeven.
      </p>
    `;

    await sendEmail(
      profile.email,
      "Belangrijk: er is een overlijden gemeld voor jouw AfterFile-account",
      emailShell("Een overlijden is gemeld voor jouw account", bodyHtml)
    );

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false });
  }
});
