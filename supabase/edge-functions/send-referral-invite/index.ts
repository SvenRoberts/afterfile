import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL       = Deno.env.get('SITE_URL')       ?? 'https://afterfile.nl';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { friendEmail, refCode, inviterName } = await req.json();

    const email = (friendEmail || '').trim().toLowerCase();
    const code  = (refCode || '').trim().toUpperCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Ongeldig e-mailadres.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!code) {
      return new Response(JSON.stringify({ error: 'Geen referral-code opgegeven.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const signupUrl = `${SITE_URL}/?ref=${encodeURIComponent(code)}`;
    const inviter   = (inviterName || '').trim() || 'Iemand die je kent';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'AfterFile <info@afterfile.nl>',
        to:      [email],
        subject: `${inviter} nodigt je uit voor AfterFile`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
            <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:24px;">AfterFile</div>
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Je bent uitgenodigd.</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
              <strong>${inviter}</strong> gebruikt AfterFile voor hun digitale nalatenschap en wil jou ook uitnodigen.
              Met AfterFile leg je al je digitale bezittingen, accounts en wensen veilig vast, zodat de mensen die je vertrouwt altijd weten wat er te regelen valt.
            </p>
            <a href="${signupUrl}" style="display:inline-block;background:#2F5DD9;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
              Bekijk AfterFile
            </a>
            <p style="color:#888;font-size:13px;margin:0 0 6px;">
              Je referral-code <strong style="font-family:monospace;color:#0f172a;">${code}</strong> is al voor je ingevuld, zodat je beiden van een korting profiteert.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
            <p style="color:#aaa;font-size:12px;margin:0;">AfterFile BV, info@afterfile.nl</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const body = await resendRes.text();
      console.error('Resend fout:', body);
      return new Response(JSON.stringify({ error: 'Mail versturen mislukt.' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('send-referral-invite fout:', e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: 'Onverwachte fout.' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
