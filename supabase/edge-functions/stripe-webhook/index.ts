import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY       = Deno.env.get('STRIPE_SECRET_KEY')       ?? '';
const STRIPE_WEBHOOK_SECRET   = Deno.env.get('STRIPE_WEBHOOK_SECRET')   ?? '';
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')            ?? '';
const SUPABASE_SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY          = Deno.env.get('RESEND_API_KEY')          ?? '';
const SITE_URL                = Deno.env.get('SITE_URL')                ?? 'https://afterfile.nl';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function stripeSign(payload: string, secret: string, signature: string): Promise<boolean> {
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const toSign = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const computed = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === parts.v1;
}

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await stripeSign(body, STRIPE_WEBHOOK_SECRET, sig);
    if (!valid) return new Response('Ongeldige handtekening', { status: 400 });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { return new Response('Ongeldige JSON', { status: 400 }); }

  const type = event.type as string;
  const obj  = event.data && (event.data as Record<string, unknown>).object as Record<string, unknown>;

  // ────────────────────────────────────────────────────────────────────────────
  // checkout.session.completed: betaling geslaagd
  // Maak Supabase-account aan als dat nog niet bestaat, stel plan in, stuur magic link.
  // ────────────────────────────────────────────────────────────────────────────
  if (type === 'checkout.session.completed') {
    const session = obj;
    const customerId    = session.customer as string;
    const subscriptionId = session.subscription as string | null;
    const meta          = (session.metadata as Record<string, string>) ?? {};
    const plan          = meta.af_plan || 'compleet';
    const name          = meta.af_name || '';
    const referredBy    = meta.af_referred_by || '';

    // Haal klantgegevens op bij Stripe voor het e-mailadres
    const custRes  = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const customer = await custRes.json();
    const email: string = (customer.email ?? '').toLowerCase();

    if (!email) {
      console.error('Geen e-mailadres op Stripe-klant', customerId);
      return new Response('ok', { status: 200 });
    }

    // Kijk of er al een Supabase-gebruiker bestaat voor dit e-mailadres
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = listErr ? null : users.find((u: { email?: string }) => u.email?.toLowerCase() === email);

    let userId: string;

    if (!existingUser) {
      // Nieuwe gebruiker aanmaken (email bevestigd, geen wachtwoord)
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: name || email.split('@')[0] },
      });
      if (createErr || !newUser?.user) {
        console.error('Supabase user aanmaken mislukt:', createErr?.message);
        return new Response('ok', { status: 200 });
      }
      userId = newUser.user.id;
      existingUser = newUser.user;
    } else {
      userId = existingUser.id;
    }

    // Idempotentie: is dit abonnement al eerder verwerkt?
    // Stripe levert webhooks soms twee keer. Een tweede generateLink-aanroep maakt
    // de eerste link ongeldig. We slaan de magic link dus over als het profiel
    // al een actief abonnement heeft met dit subscription-ID.
    const { data: alreadyActive } = subscriptionId
      ? await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .eq('subscription_status', 'active')
          .maybeSingle()
      : { data: null };

    const alreadyProcessed = !!alreadyActive;

    // Profiel bijwerken: plan + Stripe-IDs
    await supabaseAdmin.from('profiles').upsert({
      id:                     userId,
      email,
      name:                   name || email.split('@')[0],
      plan,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subscriptionId ?? null,
      subscription_status:    'active',
      referred_by:            referredBy || null,
    }, { onConflict: 'id' });

    // Payments-tabel bijwerken
    if (subscriptionId) {
      await supabaseAdmin.from('payments').upsert({
        account_id:      userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id:     customerId,
        plan,
        status:          'active',
      }, { onConflict: 'stripe_subscription_id' });
    }

    if (alreadyProcessed) {
      console.log(`Dubbele webhook voor ${email} (sub=${subscriptionId}), magic link overgeslagen.`);
      return new Response('ok', { status: 200 });
    }

    // Magic link genereren
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type:  'magiclink',
      email,
      options: { redirectTo: SITE_URL },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('Magic link genereren mislukt:', linkErr?.message);
      // Geen magic link, maar het account is wel aangemaakt, dus geen harde fout
      return new Response('ok', { status: 200 });
    }

    // Gebruik hashed_token zodat de link naar afterfile.nl wijst (geen lelijke Supabase-URL)
    // en e-mailscanners (ProtonMail e.d.) de token niet kunnen verbruiken door de URL te openen.
    const hashedToken = linkData.properties.hashed_token;
    const loginUrl = `${SITE_URL}?login=${encodeURIComponent(hashedToken)}`;

    // Welkomstmail sturen via Resend met de login-knop
    const planLabel = plan === 'premium' ? 'Premium' : 'Compleet';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'AfterFile <info@afterfile.nl>',
        to:      [email],
        subject: 'Je AfterFile-account staat klaar',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:24px">AfterFile</div>
            <h2 style="margin:0 0 8px;color:#0f172a">Welkom bij AfterFile ${planLabel}!</h2>
            <p style="color:#555;margin:0 0 24px">Je betaling is gelukt. Je account staat klaar. Klik op de knop hieronder om in te loggen, er is geen wachtwoord nodig.</p>
            <a href="${loginUrl}" style="display:inline-block;background:#2F5DD9;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Inloggen bij AfterFile</a>
            <p style="color:#888;font-size:13px;margin-top:32px">Lukt het niet? Ga naar <a href="${SITE_URL}">${SITE_URL}</a> en klik op Aanmelden om een nieuwe link te ontvangen.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
            <p style="color:#aaa;font-size:12px">AfterFile BV</p>
          </div>
        `,
      }),
    });

    console.log(`Account aangemaakt/bijgewerkt voor ${email}, plan=${plan}`);
    return new Response('ok', { status: 200 });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // customer.subscription.updated: plan of status gewijzigd
  // ────────────────────────────────────────────────────────────────────────────
  if (type === 'customer.subscription.updated') {
    const sub        = obj;
    const customerId = sub.customer as string;
    const subId      = sub.id as string;
    const status     = sub.status as string;
    const meta       = (sub.metadata as Record<string, string>) ?? {};
    const plan       = meta.af_plan || 'compleet';

    // Zoek profiel op Stripe customer ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile?.id) {
      const newPlan = status === 'active' || status === 'trialing' ? plan : 'basis';
      await supabaseAdmin.from('profiles').update({
        plan:                   newPlan,
        stripe_subscription_id: subId,
        subscription_status:    status,
      }).eq('id', profile.id);

      await supabaseAdmin.from('payments').upsert({
        account_id:             profile.id,
        stripe_subscription_id: subId,
        stripe_customer_id:     customerId,
        plan:                   newPlan,
        status,
      }, { onConflict: 'stripe_subscription_id' });
    }

    return new Response('ok', { status: 200 });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // customer.subscription.deleted: abonnement opgezegd
  // ────────────────────────────────────────────────────────────────────────────
  if (type === 'customer.subscription.deleted') {
    const sub        = obj;
    const customerId = sub.customer as string;
    const subId      = sub.id as string;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profile?.id) {
      await supabaseAdmin.from('profiles').update({
        plan:                'basis',
        subscription_status: 'canceled',
      }).eq('id', profile.id);

      await supabaseAdmin.from('payments').update({ status: 'canceled' })
        .eq('stripe_subscription_id', subId);
    }

    return new Response('ok', { status: 200 });
  }

  return new Response('ok', { status: 200 });
});
