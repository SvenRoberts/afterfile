import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://afterfile.nl';

// Stripe prijs-IDs per plan + betaalperiode
const PRICE_COMPLEET_YEAR  = Deno.env.get('STRIPE_PRICE_COMPLEET')       ?? '';
const PRICE_COMPLEET_MONTH = Deno.env.get('STRIPE_PRICE_COMPLEET_MONTH') ?? '';
const PRICE_PREMIUM        = Deno.env.get('STRIPE_PRICE_PREMIUM')        ?? '';

const PRICE_IDS: Record<string, Record<string, string>> = {
  compleet: { month: PRICE_COMPLEET_MONTH, year: PRICE_COMPLEET_YEAR },
  premium:  { month: PRICE_PREMIUM,        year: PRICE_PREMIUM       },
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const email: string         = (body.email          || '').trim().toLowerCase();
    const name: string          = (body.name           || email.split('@')[0]).trim();
    const plan: string          = body.plan            || 'compleet';
    const billingPeriod: string = body.billingPeriod   || 'year';
    const referredBy: string    = body.referredBy      || '';

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'E-mailadres ontbreekt.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const priceId = PRICE_IDS[plan]?.[billingPeriod];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Onbekend plan of betaalperiode: ${plan}/${billingPeriod}` }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // Zoek bestaande Stripe-klant op e-mail
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(email)}'&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    const searchJson = await searchRes.json();
    let customerId: string | null = searchJson?.data?.[0]?.id ?? null;

    if (!customerId) {
      // Nieuwe klant aanmaken met naam + plan in metadata (webhook gebruikt dit later)
      const custForm = new URLSearchParams();
      custForm.set('email', email);
      custForm.set('name', name);
      custForm.set('metadata[af_plan]', plan);
      custForm.set('metadata[af_name]', name);
      if (referredBy) custForm.set('metadata[af_referred_by]', referredBy);
      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: custForm.toString(),
      });
      const custJson = await custRes.json();
      if (!custRes.ok || !custJson.id) throw new Error(custJson?.error?.message || 'Stripe-klant aanmaken mislukt');
      customerId = custJson.id;
    } else {
      // Bestaande klant: update metadata met het nieuwe plan
      const updForm = new URLSearchParams();
      updForm.set('metadata[af_plan]', plan);
      updForm.set('metadata[af_name]', name);
      if (referredBy) updForm.set('metadata[af_referred_by]', referredBy);
      await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: updForm.toString(),
      });
    }

    // Checkout Session aanmaken
    const sp = new URLSearchParams();
    sp.set('customer', customerId);
    sp.set('mode', 'subscription');
    sp.set('line_items[0][price]', priceId);
    sp.set('line_items[0][quantity]', '1');
    sp.set('success_url', `${SITE_URL}?checkout=success`);
    sp.set('cancel_url',  `${SITE_URL}?checkout=cancelled`);
    // Plan in metadata zodat webhook het kan lezen
    sp.set('metadata[af_plan]', plan);
    sp.set('metadata[af_name]', name);
    sp.set('metadata[af_billing_period]', billingPeriod);
    if (referredBy) sp.set('metadata[af_referred_by]', referredBy);
    sp.set('subscription_data[metadata][af_plan]', plan);

    // iDEAL → SEPA Direct Debit mandaat: na de eerste iDEAL-betaling maakt Stripe
    // automatisch een SEPA-mandaat aan zodat vervolgperiodes zonder gebruikersactie
    // worden geïncasseerd.
    sp.set('payment_method_types[0]', 'card');
    sp.set('payment_method_types[1]', 'ideal');
    sp.set('payment_method_options[ideal][setup_future_usage]', 'off_session');
    sp.set('subscription_data[payment_settings][save_default_payment_method]', 'on_subscription');
    sp.set('subscription_data[payment_settings][payment_method_types][0]', 'sepa_debit');
    sp.set('subscription_data[payment_settings][payment_method_types][1]', 'ideal');
    sp.set('subscription_data[payment_settings][payment_method_types][2]', 'card');

    const sessRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sp.toString(),
    });
    const sessJson = await sessRes.json();
    if (!sessRes.ok || !sessJson.url) throw new Error(sessJson?.error?.message || 'Checkout session aanmaken mislukt');

    return new Response(JSON.stringify({ url: sessJson.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('create-checkout-session fout:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
