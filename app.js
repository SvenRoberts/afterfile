// AfterFile — webapp met een echte Supabase-backend (database + login via magic link, geen
// wachtwoord). Accountgegevens (account, bezittingen, contacten, instructies, persoonsgegevens)
// leven in Supabase, niet meer alleen in deze browser. De Beheer-pagina en de "meld een
// overlijden"-demo zijn nog niet gemigreerd en werken voorlopig nog lokaal, zie saveState().
//
// Alles hieronder staat in een IIFE (meteen aanroepende functie): zo komen onze eigen
// var/let/const/function-namen (zoals "supabase") nooit in de globale scope terecht. Dat
// voorkomt "Identifier 'supabase' has already been declared"-fouten als er, om wat voor
// reden dan ook (een extensie, een dubbele scriptinclusie, een cache-kwestie), nog een
// tweede declaratie van diezelfde naam in de globale scope belandt: onze eigen code kan
// daar dan nooit meer mee botsen, wat de oorzaak ook precies is.
(function () {

const LOCAL_DEMO_KEY = 'afterfile_demo_extra_v1';

// Naast de basisvakken (naam, beschrijving, locatie, notities) heeft elk type nog een
// klein aantal extra, type-specifieke vakken: net genoeg om iets te herkennen of terug
// te vinden, nooit een wachtwoord, code of andere inloggegevens.
const ASSET_CATEGORIES = [
  { key: 'financial', label: 'Financieel', types: [
      { key: 'bank', label: 'Bankrekening', icon: 'bank', namePlaceholder: 'bijv. Betaalrekening ING', extraFields: [
          { key: 'bankName', label: 'Bank', placeholder: 'bijv. ING, Rabobank, ABN AMRO' },
      ]},
      { key: 'crypto', label: 'Crypto', icon: 'diamond', namePlaceholder: 'bijv. Bitcoin wallet Ledger', extraFields: [
          { key: 'walletType', label: 'Soort wallet of platform', placeholder: 'bijv. hardware wallet (Ledger), Coinbase-account' },
      ]},
      { key: 'broker', label: 'Broker', icon: 'trending-up', namePlaceholder: 'bijv. Beleggingsrekening DEGIRO', extraFields: [
          { key: 'platform', label: 'Naam broker of platform', placeholder: 'bijv. DEGIRO, Saxo Bank, eToro' },
      ]},
      { key: 'pension', label: 'Pensioen', icon: 'umbrella', namePlaceholder: 'bijv. Pensioen via werkgever', extraFields: [
          { key: 'provider', label: 'Pensioenuitvoerder', placeholder: 'bijv. ABP, ASR, BrightPensioen' },
      ]},
  ]},
  { key: 'digital', label: 'Digitaal', types: [
      { key: 'website', label: 'Website', icon: 'globe', namePlaceholder: 'bijv. Facebook account', extraFields: [
          { key: 'username', label: 'Gebruikersnaam', placeholder: 'bijv. jouwgebruikersnaam' },
      ]},
      { key: 'domain', label: 'Domeinnaam', icon: 'link', namePlaceholder: 'bijv. mijnwebsite.nl', extraFields: [
          { key: 'registrar', label: 'Registrar', placeholder: 'bijv. TransIP, Vimexx' },
      ]},
      { key: 'cloud', label: 'Cloudopslag', icon: 'cloud', namePlaceholder: 'bijv. Google Drive opslag', extraFields: [
          { key: 'provider', label: 'Provider', placeholder: 'bijv. Google Drive, Dropbox, iCloud' },
      ]},
      { key: 'email', label: 'E-mailaccount', icon: 'mail', namePlaceholder: 'bijv. Gmail prive', extraFields: [
          { key: 'provider', label: 'Provider', placeholder: 'bijv. Gmail, Outlook, Proton Mail' },
      ]},
  ]},
  { key: 'other', label: 'Overig', types: [
      { key: 'safe', label: 'Kluis', icon: 'safe', namePlaceholder: 'bijv. Brandkast slaapkamer', extraFields: [
          { key: 'keyHolder', label: 'Wie heeft toegang of de sleutel', placeholder: 'bijv. ligt bij de buren, in de meterkast' },
      ]},
      { key: 'documents', label: 'Fysieke documenten', icon: 'document', namePlaceholder: 'bijv. Testament bij notaris', extraFields: [
          { key: 'documentType', label: 'Type document', placeholder: 'bijv. testament, paspoort, eigendomsbewijs' },
      ]},
      { key: 'password-manager', label: 'Wachtwoordmanager', icon: 'key', namePlaceholder: 'bijv. Mijn wachtwoordkluis', extraFields: [
          { key: 'app', label: 'Welke app', placeholder: 'bijv. 1Password, Bitwarden, LastPass' },
          { key: 'keyLocation', label: 'Waar staat de masterkey / emergency kit', placeholder: 'bijv. in een envelop bij de notaris, in de kluis thuis' },
      ]},
      { key: 'other', label: 'Overige belangrijke informatie', icon: 'folder', namePlaceholder: 'bijv. Lidmaatschap sportclub' },
  ]},
];

// ---------- icons ----------
// Hand-drawn line-icon set (no emoji, no external icon font) — consistent
// 24x24 stroke style so the whole product reads as one deliberate system.
const ICON_PATHS = {
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
  'shield-check': '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"></path><path d="M9 12l2 2 4-4"></path>',
  'eye-off': '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"></path><circle cx="12" cy="12" r="2.5"></circle><path d="M4 4l16 16"></path>',
  'key-off': '<circle cx="8" cy="14.5" r="3.2"></circle><path d="M10.3 12.2 19 3.5"></path><path d="M15.5 7 18 9.5M13 9.5l2 2"></path><path d="M4 4l16 16"></path>',
  key: '<circle cx="8" cy="14.5" r="3.2"></circle><path d="M10.3 12.2 19 3.5"></path><path d="M15.5 7 18 9.5M13 9.5l2 2"></path>',
  ban: '<circle cx="12" cy="12" r="8.5"></circle><path d="M6.5 6.5l11 11"></path>',
  'file-text': '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"></path><path d="M14 3v4h4"></path><path d="M9 13h6M9 16.5h6"></path>',
  bank: '<path d="M3 10l9-5 9 5"></path><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"></path><path d="M3 20h18"></path>',
  diamond: '<path d="M4 9l4-5h8l4 5-8 11-8-11z"></path><path d="M4 9h16M9.5 4 7 9l5 11 5-11-2.5-5"></path>',
  'trending-up': '<path d="M4 16l5-5 4 4 7-7"></path><path d="M16 7h4v4"></path>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0H3z"></path><path d="M12 12v7a2 2 0 0 1-3.5 1.3"></path><path d="M12 3v2"></path>',
  globe: '<circle cx="12" cy="12" r="8.5"></circle><path d="M3.5 12h17M12 3.5c2.2 2.3 3.5 5.3 3.5 8.5s-1.3 6.2-3.5 8.5c-2.2-2.3-3.5-5.3-3.5-8.5S9.8 5.8 12 3.5z"></path>',
  link: '<path d="M9.5 14.5l5-5"></path><path d="M8 16l-2 2a3.5 3.5 0 0 1-5-5l2-2"></path><path d="M16 8l2-2a3.5 3.5 0 0 1 5 5l-2 2"></path>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.7-1.7A4 4 0 0 1 17 18H7z"></path>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path>',
  safe: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="12" cy="12" r="3.2"></circle><path d="M9 6h.01M15 6h.01M9 18h.01M15 18h.01"></path>',
  document: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"></path><path d="M14 3v4h4"></path>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"></path>',
  download: '<path d="M12 4v11"></path><path d="M7.5 11 12 15.5 16.5 11"></path><path d="M5 19h14"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"></path>',
  users: '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path><circle cx="17.5" cy="9" r="2.3"></circle><path d="M15.3 19c.2-2.1 1.7-3.8 3.6-4.4"></path>',
  'chevron-down': '<path d="M6 9l6 6 6-6"></path>',
  info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 7.6h.01"></path>',
  x: '<path d="M6 6l12 12M18 6 6 18"></path>',
};
function iconSvg(name, size) {
  size = size || 20;
  const inner = ICON_PATHS[name] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// Wordmark glyph: a shield with a key — the AfterFile mark.
// Refined shield proportions, a soft drop shadow and a subtle top sheen,
// with a simple line-art key (access/legacy) instead of a checkmark.
let _logoGradSeq = 0;
function logoMark(size) {
  size = size || 28;
  const n = _logoGradSeq++;
  const gid = 'logoGrad' + n;
  const sid = 'logoShadow' + n;
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${gid}" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3D63E6"></stop>
        <stop offset="100%" stop-color="#2747C2"></stop>
      </linearGradient>
      <filter id="${sid}" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#1B2C6B" flood-opacity="0.22"></feDropShadow>
      </filter>
    </defs>
    <path filter="url(#${sid})" d="M16 2.5L27 7.1V15.3C27 22.9 22 28.1 16 30.2C10 28.1 5 22.9 5 15.3V7.1L16 2.5Z" fill="url(#${gid})"></path>
    <path d="M9.2 10.6C11.2 9.3 13.5 8.6 16 8.6C18.5 8.6 20.8 9.3 22.8 10.6" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"></path>
    <circle cx="16" cy="15.6" r="2.9" fill="none" stroke="#ffffff" stroke-width="2.2"></circle>
    <rect x="14.7" y="18.5" width="2.6" height="6.8" fill="#ffffff"></rect>
    <rect x="17.3" y="21.5" width="2.2" height="1.5" fill="#ffffff"></rect>
    <rect x="17.3" y="23.9" width="2.8" height="1.5" fill="#ffffff"></rect>
  </svg>`;
}

const RELATIONSHIP_SUGGESTIONS = ['Partner', 'Kind', 'Executeur', 'Vriend(in)'];

// Vast, voor iedereen gelijk notificatieproces (geen per-contact instelling meer):
// een vertrouwd contact met de rol "verify" kan op elk moment, via de sectie "Overlijden
// melden" op de landingspagina, een overlijden melden -> 30 dagen wachttijd -> informatie
// gedeeld met de contacten met de rol "inform".
const WAITING_PERIOD_DAYS = 30;

const TRUST_LINE = 'AfterFile bewaart nooit wachtwoorden, private keys of herstelcodes.';

const LAUNCH_OFFER_MONTHS = 6;

// Vóór de echte lancering bieden we i.p.v. de volledige betaalflow alleen een wachtlijst
// aan. Alle bestaande checkout-/signup-code blijft volledig intact en functioneel: zet
// deze vlag na de lancering op false en alle knoppen werken weer zoals voorheen.
const PRELAUNCH_MODE = true;

// Partner-referral: ingesteld via ?partner=slug in de URL (bijv. afterfile.nl?partner=notariskantoor-x).
// Wordt opgeslagen voor de sessie en getoond als welkomstbanner op de wachtlijstpagina.
let partnerRef = '';

// Zodat de eigenaar zelf, ondanks PRELAUNCH_MODE, gewoon kan blijven doorbouwen en testen:
// Bypass-check via Supabase: owners en partners staan in de profiles tabel (role kolom).
// Geen emailadressen meer hardcoded in de frontend.

const PLANS = [
  {
    key: 'basis', name: 'Basis', price: '€0', period: '/ maand', billing: 'Altijd gratis te gebruiken',
    features: ['Tot 3 bezittingen vastleggen', '1 vertrouwd contact', 'Eenvoudige instructies'],
    missingFeatures: ['Geen Legacy Report (PDF)', 'Geen e-mailherinneringen'],
    cta: 'Begin gratis', featured: false,
  },
  {
    key: 'compleet', name: 'Compleet', price: '€3,95', period: '/ maand', billing: 'Jaarlijks gefactureerd: €39,95, bespaar 16%',
    features: ['Onbeperkt bezittingen', 'Tot 5 vertrouwde contacten', 'Volledig Legacy Report (PDF)', 'Jaarlijkse reminder om gegevens bij te werken'],
    cta: 'Aan de slag', featured: true, launchEligible: true,
  },
];

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'iDEAL'];

function defaultState() {
  return {
    account: null,
    assets: [],
    contacts: [],
    instructions: '',
    personalInfo: { fullName: '', street: '', postalCode: '', city: '', birthDate: '', phone: '' },
    signups: [],
    waitlist: [],
    checkins: { status: 'active', waitingStartedAt: null },
    view: 'landing',
    completedAt: null,
  };
}

// ---------- Supabase ----------
// Project URL en publishable key zijn geen geheimen (RLS beperkt sowieso wat elke gebruiker
// kan zien/doen), dus veilig om hier in de clientcode te zetten.
const SUPABASE_URL = 'https://prkwfuiadjfpdmcorfas.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hqegYtKJNyF6z09_-kXcUg_nJMfkXW3';

// Als het Supabase-client aanmaken faalt, mag dat de rest van de site nooit blokkeren:
// we loggen het alleen naar de console en gaan verder. supabase blijft dan undefined,
// en de code hieronder die supabase gebruikt is daar al overal op voorbereid (if (supabase)).
let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase-client aanmaken faalde — site blijft verder lokaal werken:', e);
}

// state.signups/state.waitlist zijn de nog-niet-gemigreerde demo-onderdelen (Beheer-pagina,
// "meld een overlijden"-demo): die blijven voorlopig lokaal in déze browser. De échte
// accountgegevens (account/assets/contacts/personalInfo/instructions/checkins) komen
// voortaan uit Supabase, zie loadAccountFromSupabase() en applySession() hieronder.
function loadLocalDemoState() {
  try {
    const raw = localStorage.getItem(LOCAL_DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { signups: parsed.signups || [], waitlist: parsed.waitlist || [] };
    }
  } catch (e) { /* ignore corrupt state */ }
  return { signups: [], waitlist: [] };
}
function saveLocalDemoState() {
  localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify({ signups: state.signups, waitlist: state.waitlist }));
}
// ============================================================
// KLUIS - client-side AES-256-GCM versleuteld, geen server
// ============================================================
const VK_SALT  = 'af_v_salt';
const VK_CHECK = 'af_v_check';
const VK_DATA  = 'af_v_data';
const VK_PLAIN = 'afterfile-vault-v1';
const VK_LOCK_MS = 5 * 60 * 1000;

async function vkDeriveKey(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function vkEnc(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
}
async function vkDec(key, b64) {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12))
  );
}
async function vkUnlock(pw) {
  const saltB64 = localStorage.getItem(VK_SALT);
  if (!saltB64) return false;
  try {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const key  = await vkDeriveKey(pw, salt);
    if (await vkDec(key, localStorage.getItem(VK_CHECK)) !== VK_PLAIN) return false;
    ui.vaultKey   = key;
    const raw = localStorage.getItem(VK_DATA);
    ui.vaultData  = raw ? JSON.parse(await vkDec(key, raw)) : { entries: [] };
    ui.vaultState = 'unlocked';
    vkResetTimer();
    return true;
  } catch { return false; }
}
async function vkSetup(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await vkDeriveKey(pw, salt);
  localStorage.setItem(VK_SALT,  btoa(String.fromCharCode(...salt)));
  localStorage.setItem(VK_CHECK, await vkEnc(key, VK_PLAIN));
  ui.vaultKey = key; ui.vaultData = { entries: [] }; ui.vaultState = 'unlocked';
  vkResetTimer();
  await vkSave();
}
async function vkSave() {
  if (!ui.vaultKey || !ui.vaultData) return;
  localStorage.setItem(VK_DATA, await vkEnc(ui.vaultKey, JSON.stringify(ui.vaultData)));
}
function vkLock() {
  if (ui.vaultLockTimer) clearTimeout(ui.vaultLockTimer);
  Object.assign(ui, { vaultKey: null, vaultData: null, vaultState: localStorage.getItem(VK_SALT) ? 'locked' : 'setup', vaultModal: null });
  if (state.view === 'vault') render();
}
function vkResetTimer() {
  if (ui.vaultLockTimer) clearTimeout(ui.vaultLockTimer);
  ui.vaultLockTimer = setTimeout(vkLock, VK_LOCK_MS);
}


// Bewaart alleen de nog-niet-gemigreerde demo-onderdelen (state.signups/state.waitlist),
// gebruikt door de "meld een overlijden"-demo en de Beheer-pagina. De echte accountgegevens
// gaan voortaan via de losse Supabase-aanroepen in wireEvents() en loadAccountFromSupabase().
function saveState() {
  syncCurrentSignupRecord();
  saveLocalDemoState();
}

// Zet ruwe Supabase-rijen (snake_case) om naar de camelCase-vorm die de render-functies al
// gebruiken, zodat de rest van de app ongewijzigd kan blijven.
function rowToAsset(row) {
  return {
    id: row.id, categoryKey: row.category_key, typeKey: row.type_key, typeLabel: row.type_label,
    name: row.name, extra: row.extra || {}, description: row.description, location: row.location,
    notes: row.notes, createdAt: row.created_at,
  };
}
function rowToContact(row) {
  return {
    id: row.id, name: row.name, email: row.email, relationship: row.relationship,
    address: row.address, birthDate: row.birth_date, phone: row.phone,
    roles: row.roles && row.roles.length ? row.roles : ['inform'], createdAt: row.created_at,
  };
}

// Haalt het profiel + bezittingen + contacten op uit Supabase en vult de lokale state-cache,
// die de render-functies verder ongewijzigd kunnen blijven uitlezen. Wordt aangeroepen na elke
// succesvolle login/sessie-herstel (zie applySession()). De profiel-rij wordt normaal direct
// door de handle_new_user()-trigger aangemaakt; mocht die nog niet klaar zijn (race net na de
// allereerste keer inloggen), proberen we het hier zelf nog een paar keer met een korte vertraging.
async function loadAccountFromSupabase(userId, email, attempt) {
  attempt = attempt || 0;
  const [{ data: profile, error: profileError }, { data: assets }, { data: contacts }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('assets').select('*').eq('account_id', userId).order('created_at', { ascending: true }),
    supabase.from('contacts').select('*').eq('account_id', userId).order('created_at', { ascending: true }),
  ]);
  if (profileError || !profile) {
    if (attempt >= 3) {
      flashToast('Kon je profiel niet laden. Vernieuw de pagina en probeer opnieuw.');
      return;
    }
    await new Promise(r => setTimeout(r, 600));
    return loadAccountFromSupabase(userId, email, attempt + 1);
  }
  state.account = { id: userId, name: profile.name || email.split('@')[0], email: profile.email || email, plan: profile.plan, createdAt: profile.created_at, role: profile.role || 'user' };
  state.personalInfo = {
    fullName: profile.full_name || '', street: profile.street || '', postalCode: profile.postal_code || '',
    city: profile.city || '', birthDate: profile.birth_date || '', phone: profile.phone || '',
  };
  state.instructions = profile.instructions || '';
  state.checkins = { status: profile.checkin_status || 'active', waitingStartedAt: profile.waiting_started_at };
  state.completedAt = profile.completed_at ? new Date(profile.completed_at).getTime() : null;
  state.assets = (assets || []).map(rowToAsset);
  state.contacts = (contacts || []).map(rowToContact);

  // Veiligheidsmechanisme: gewoon opnieuw inloggen is de manier om een onterechte
  // overlijdensmelding te stoppen. Staat het profiel hier op 'waiting', dan annuleren we de
  // melding dus automatisch via cancel_death_report() vóórdat de gebruiker iets te zien krijgt.
  if (state.checkins.status === 'waiting') {
    const { error: cancelError } = await supabase.rpc('cancel_death_report');
    if (!cancelError) {
      state.checkins = { status: 'active', waitingStartedAt: null };
      flashToast('Er liep een overlijdensmelding voor je account. Omdat je weer bent ingelogd, is deze automatisch geannuleerd.');
    } else {
      console.error('cancel_death_report RPC mislukt', cancelError);
    }
  }

  syncCurrentSignupRecord();
  saveLocalDemoState();
  if (!state.personalInfo?.fullName && !localStorage.getItem('af_onboarding_done')) {
    ui.onboardingStep = 1;
  }
}

// Eén centrale plek die reageert op elke sessiewijziging: eerste laden, magic-link-redirect
// (inloggen), en uitloggen. Vervangt de oude synchrone init()/createAccount()-aanpak; supabase-js
// roept dit altijd minstens één keer aan bij het laden van de pagina (met de huidige sessie, of
// null als er geen is), dus een losse init()-functie is niet meer nodig.
async function applySession(session) {
  if (session && session.user) {
    await loadAccountFromSupabase(session.user.id, session.user.email);
  } else {
    state.account = null;
    state.assets = [];
    state.contacts = [];
    state.instructions = '';
    state.personalInfo = defaultState().personalInfo;
    state.checkins = { status: 'active', waitingStartedAt: null };
    state.completedAt = null;
  }
  if (state.account && ['landing', 'signup', 'waitlist'].includes(state.view)) state.view = 'dashboard';
  if (!state.account && ['dashboard', 'gegevens', 'assets', 'contacts', 'instructions', 'report', 'admin'].includes(state.view)) state.view = 'landing';
  render();
}

// Stuurt de gebruiker naar de Stripe-hosted Checkout-pagina voor het gekozen betaalde plan.
// De Edge Function create-checkout-session (server-side) maakt de Checkout Session aan met
// Stripe's geheime sleutel, hier op de client komt nooit een Stripe-sleutel voor. Een vlag
// (ui.checkoutRedirecting) voorkomt dat een dubbelklik/dubbele aanroep twee sessions opent.
async function startCheckout(planKey) {
  if (!supabase || !state.account || ui.checkoutRedirecting) return;
  ui.checkoutRedirecting = true;
  render();
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { plan: planKey, billingPeriod: ui.billingPeriod || 'year' } });
    if (error || !data || !data.url) throw error || new Error('Geen checkout-url ontvangen');
    window.location.href = data.url;
  } catch (e) {
    console.error('Stripe checkout starten mislukt:', e);
    ui.checkoutRedirecting = false;
    flashToast('Kon de betaalpagina niet openen. Probeer het opnieuw.');
    render();
  }
}

// Echte upgrade voor klanten die al een betaald abonnement hebben (Compleet -> Premium): past
// de BESTAANDE Stripe-subscription aan (prijs wijzigen met proration) via de
// change-subscription-plan Edge Function, in plaats van een nieuwe Checkout Session/subscription
// te starten zoals startCheckout() hierboven doet. Dat voorkomt dat een al betalende klant per
// ongeluk een tweede, los betalende subscription krijgt. Stripe's webhook
// (customer.subscription.updated) werkt profiles.plan zelf bij zodra Stripe de wijziging
// bevestigt; we wachten dat hier even op en laden het account daarna opnieuw in.
async function changeSubscriptionPlan(planKey) {
  if (!supabase || !state.account || ui.checkoutRedirecting) return;
  ui.checkoutRedirecting = true;
  render();
  try {
    const { data, error } = await supabase.functions.invoke('change-subscription-plan', { body: { plan: planKey } });
    if (error || !data || !data.ok) throw error || new Error('Abonnement wijzigen mislukt');
    flashToast('Upgrade gestart! Je nieuwe abonnement wordt binnen enkele seconden bijgewerkt.');
    await new Promise(r => setTimeout(r, 1500));
    await loadAccountFromSupabase(state.account.id, state.account.email);
  } catch (e) {
    console.error('Abonnement wijzigen mislukt:', e);
    flashToast('Kon je abonnement niet wijzigen. Probeer het opnieuw of neem contact op.');
  } finally {
    ui.checkoutRedirecting = false;
    render();
  }
}

// Direct na een verse magic-link-login (niet bij een herstelde sessie bij het laden van de
// pagina): als de gebruiker bij het aanmelden een betaald plan koos, sturen we hem nu meteen
// door naar Stripe Checkout. state.account.plan staat op dit punt al klaar (loadAccountFromSupabase
// is hierboven al uitgevoerd), dus iemand die al een betaald plan heeft slaat dit gewoon over.
function maybeStartCheckout(session) {
  if (!session || !session.user || !state.account) return;
  const planKey = session.user.user_metadata && session.user.user_metadata.selected_plan;
  if (!planKey || planKey === 'basis') return;
  if (state.account.plan !== 'basis') return;
  startCheckout(planKey);
}

let state = Object.assign(defaultState(), loadLocalDemoState());
let ui = { vaultState: localStorage.getItem('af_v_salt') ? 'locked' : 'setup', vaultKey: null, vaultData: null, vaultModal: null, vaultLockTimer: null, onboardingStep: 0, addingAssetType: null, addingAsset: false, addingContact: false, draftAsset: {}, draftContact: {}, openFaqIndex: null, selectedPlanKey: null, billingPeriod: 'year', betalingOpen: false, signupEmailError: null, signupSubmitting: false, magicLinkSentTo: null, openSignupId: null, accountMenuOpen: false, contactInvitePreview: null, deathReportErrors: null, deathReportResult: null, deathReportSubmitting: false, waitlistEmailError: null, waitlistJoined: false, checkoutRedirecting: false, waitlistTab: 'waitlist', partnerFormSent: false, partnerFormError: null };
const COMPLETION_CONFIRM_MS = 3 * 60 * 1000; // de bevestiging is tijdelijk: 3 minuten zichtbaar
let completionHideTimer = null;

// Render meteen, synchroon, met de lokale staat — de site is zo altijd direct zichtbaar
// en werkt volledig op zichzelf, zonder op Supabase te wachten of daarvan af te hangen.
// Onvoorwaardelijk: zelfs als Supabase hierboven faalde verschijnt de site gewoon.
render();

// Stripe stuurt de gebruiker na Checkout terug naar success_url/cancel_url (zie
// create-checkout-session), met een ?checkout=success of ?checkout=cancelled query-param.
// We tonen daarvoor één keer een toast en ruimen daarna de query-param op, zodat een
// her-laden van de pagina niet steeds opnieuw dezelfde melding toont. Het profiel zelf
// (plan/subscription_status) wordt los hiervan bijgewerkt door de stripe-webhook Edge
// Function, dat kan een paar seconden na de redirect pas binnen zijn.
(function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const checkoutResult = params.get('checkout');
  if (!checkoutResult) return;
  if (checkoutResult === 'success') {
    flashToast('Betaling gelukt. Je abonnement wordt geactiveerd, dit kan even duren.');
  } else if (checkoutResult === 'cancelled') {
    flashToast('Betaling geannuleerd. Je kunt het op elk moment opnieuw proberen via je dashboard.');
  }
  params.delete('checkout');
  const newSearch = params.toString();
  history.replaceState(null, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
})();

// Partner-referral: lees ?partner= uit de URL en sla op in partnerRef.
// De parameter blijft in de URL staan zodat hij na een harde herlaad bewaard blijft.
(function handlePartnerRef() {
  const params = new URLSearchParams(window.location.search);
  const p = (params.get('partner') || '').trim().slice(0, 80);
  if (p) partnerRef = p;
})();

// Een eventuele Supabase-sessie is hierna puur een optionele, latere upgrade naar de
// ingelogde weergave (bv. na een magic-link-redirect). Belangrijk: deze callback moet
// synchroon blijven en mag zelf geen Supabase-aanroepen doen, want supabase-js voert hem
// uit terwijl het een exclusieve lock vasthoudt; elke supabase.from()/auth-aanroep
// daarbinnen (zoals in applySession()) blokkeert dan alle volgende Supabase-aanroepen
// voor altijd (bekende bug, zie
// https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0).
// Met setTimeout schuiven we het echte werk naar de volgende tick, buiten die lock.
// Faalt dit, of komt het nooit binnen: de net getoonde site blijft gewoon werken, alleen
// zonder automatisch inloggen/sessieherstel.
if (supabase) {
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        applySession(session).then(() => {
          // Alleen direct na een nieuwe magic-link-login een eventuele checkout starten, niet
          // bij elke sessie-herstel (anders zou een betaalde gebruiker bij elke paginalaad
          // opnieuw naar Stripe gestuurd worden als de redirect ooit eens onderbroken werd).
          if (event === 'SIGNED_IN') maybeStartCheckout(session);
        }).catch((e) => console.error('applySession faalde (site blijft verder werken):', e));
      }, 0);
    });
  } catch (e) {
    console.error('onAuthStateChange registratie faalde (site blijft verder werken zonder login-herstel):', e);
  }
}

function navigate(view) {
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

// ---------- helpers ----------
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
// Datumconversies: Supabase slaat op als YYYY-MM-DD, UI toont DD-MM-JJJJ.
function toNlDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}-${m}-${y}` : iso;
}
function toIsoDate(nl) {
  if (!nl) return '';
  const [d, m, y] = nl.split('-');
  return (d && m && y) ? `${y}-${m}-${d}` : nl;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(d) { return d.toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' }); }
function findType(categoryKey, typeKey) {
  const cat = ASSET_CATEGORIES.find(c => c.key === categoryKey);
  return cat ? cat.types.find(t => t.key === typeKey) : null;
}
function rolesLabel(roles) {
  roles = roles || [];
  const parts = [];
  if (roles.includes('verify')) parts.push('Helpt bevestigen');
  if (roles.includes('inform')) parts.push('Ontvangt informatie');
  return parts.join(' · ') || 'Contact';
}
function personalInfoComplete() {
  const p = state.personalInfo || {};
  return ['fullName', 'street', 'postalCode', 'city', 'birthDate', 'phone'].every(k => (p[k] || '').trim().length > 0);
}
// Zodra de gebruiker zijn volledige naam heeft ingevuld bij "Mijn gegevens", gebruiken we
// daarvan de voornaam. Tot die tijd vallen we terug op de naam van het account (die bij
// aanmelden zonder naam afgeleid is uit het e-mailadres, en dus niet altijd een echte naam is).
function getFirstName() {
  const fullName = ((state.personalInfo || {}).fullName || '').trim();
  if (fullName) return fullName.split(' ')[0];
  const accountName = (state.account && state.account.name) || '';
  return accountName.split(' ')[0] || accountName;
}
function computeCompletion() {
  const infoScore = personalInfoComplete() ? 1 : 0;
  const assetsScore = state.assets.length > 0 ? 1 : 0;
  const contactsScore = state.contacts.length > 0 ? 1 : 0;
  return Math.round(((infoScore + assetsScore + contactsScore) / 3) * 100);
}

// Houdt de "database" van aanmeldingen (state.signups) gelijk aan de actieve werkruimte.
// Dit blijft volledig clientside: er wordt nergens echt iets naartoe verzonden, alles
// staat alleen in localStorage van deze browser.
function syncCurrentSignupRecord() {
  if (!state.account) return;
  if (!state.account.signupId) state.account.signupId = uid();
  state.signups = state.signups || [];
  let rec = state.signups.find(s => s.id === state.account.signupId);
  if (!rec) {
    rec = { id: state.account.signupId, createdAt: state.account.createdAt || new Date().toISOString() };
    state.signups.push(rec);
  }
  rec.name = state.account.name;
  rec.email = state.account.email;
  rec.plan = state.account.plan;
  rec.personalInfo = state.personalInfo;
  rec.assets = state.assets;
  rec.contacts = state.contacts;
  rec.instructions = state.instructions;
  rec.checkins = state.checkins;
}

// ---------- vast notificatieproces (melding door een vertrouwd contact) ----------
// Dit is voor iedereen hetzelfde: een vertrouwd contact met de rol "Helpen bevestigen" kan
// op elk moment, via de "Overlijden melden"-link in de header (eigen pagina, niet op de
// landingspagina zelf), een overlijden
// melden. Daarbij geeft het contact zowel de naam en het e-mailadres van de overledene op
// als zijn/haar eigen contactgegevens, ter verificatie. We zoeken op het e-mailadres van de
// overledene in de lokaal opgeslagen aanmeldingen (state.signups, dezelfde "database" die
// ook Beheer gebruikt) en starten zo de wachttijd van WAITING_PERIOD_DAYS dagen voor dat
// account. Omdat dit een statische demo zonder server is, kan er geen echte tijd verstrijken:
// de "simuleer..."-actie bestaat alleen om dat verloop hier zichtbaar te maken.
function findSignupByEmail(email) {
  const target = (email || '').trim().toLowerCase();
  if (!target) return null;
  return (state.signups || []).find(s => (s.email || '').toLowerCase() === target) || null;
}
function submitDeathReport(details) {
  const rec = findSignupByEmail(details.deceasedEmail);
  if (!rec) return { type: 'not-found' };
  rec.checkins = rec.checkins || { status: 'active' };
  if (rec.checkins.status === 'waiting') return { type: 'already-waiting', signupId: rec.id, deceasedName: rec.name };
  if (rec.checkins.status === 'shared') return { type: 'already-shared', signupId: rec.id, deceasedName: rec.name };
  rec.checkins = {
    status: 'waiting',
    waitingStartedAt: new Date().toISOString(),
    reportedBy: {
      name: details.reporterName,
      email: details.reporterEmail,
      phone: details.reporterPhone,
      relationship: details.relationship,
      message: details.message,
    },
  };
  if (state.account && state.account.signupId === rec.id) state.checkins = rec.checkins;
  saveState();
  return { type: 'matched', signupId: rec.id, deceasedName: rec.name };
}
function simulateWaitingElapsedForSignup(signupId) {
  const rec = (state.signups || []).find(s => s.id === signupId);
  if (!rec || !rec.checkins || rec.checkins.status !== 'waiting') return;
  rec.checkins.status = 'shared';
  if (state.account && state.account.signupId === signupId) state.checkins = rec.checkins;
  if (ui.deathReportResult && ui.deathReportResult.signupId === signupId) ui.deathReportResult = { ...ui.deathReportResult, type: 'shared-now' };
  saveState();
  render();
}

// ---------- echte meldingsflow (live Supabase RPC) ----------
// Vervangt, voor de daadwerkelijke "Overlijden melden"-pagina, de lokale simulatie hierboven
// door de live report_death()-RPC. Die RPC zoekt zelf het account op e-mailadres op, zet bij
// een nieuwe melding de wachttijd van WAITING_PERIOD_DAYS dagen in gang en is idempotent voor
// een al lopende of al gedeelde melding. We vertalen hier alleen de result_status van de RPC
// ('not_found'/'waiting'/'shared') naar de bestaande UI-resultaattypes die
// renderDeathReportResult() al kent ('not-found'/'already-waiting'/'already-shared'/default).
// Elk resultaat krijgt real:true, zodat renderDeathReportResult() de
// "Simuleer einde wachttijd (demo)"-knop nooit toont bij een echte melding.
async function reportDeathViaSupabase(details) {
  // Akte uploaden naar Supabase Storage als bijgevoegd
  let hasCertificate = false;
  let certificatePath = '';
  if (details.certificateFile) {
    const file = details.certificateFile;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `reports/${Date.now()}-${safeName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('death-certificates')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error('Akte upload mislukt', uploadError);
      // Niet fataal: doorgaan zonder akte (30-daagse wachttijd)
    } else {
      hasCertificate = true;
      certificatePath = uploadData.path;
    }
  }

  const { data, error } = await supabase.rpc('report_death', {
    p_target_email:     details.deceasedEmail,
    p_reporter_name:    details.reporterName,
    p_reporter_email:   details.reporterEmail,
    p_reporter_phone:   details.reporterPhone || '',
    p_relationship:     details.relationship || '',
    p_message:          details.message || '',
    p_has_certificate:  hasCertificate,
    p_certificate_path: certificatePath,
  });
  if (error) {
    console.error('report_death RPC mislukt', error);
    return { type: 'error', real: true };
  }
  const row = (data && data[0]) || { result_status: 'not_found' };
  const deceasedName = row.deceased_name || details.deceasedName;
  if (row.result_status === 'not_found') return { type: 'not-found', real: true };
  if (row.result_status === 'shared') return { type: 'already-shared', deceasedName, real: true };
  if (row.result_status === 'waiting' && !row.is_new) return { type: 'already-waiting', deceasedName, hasCertificate: row.has_certificate, real: true };
  // Verse melding: stuur de vangnet-mail naar het account zelf (legt uit dat opnieuw inloggen
  // de melding annuleert). Niet blokkerend voor de UI — als deze faalt, is de melding zelf al
  // wel correct verwerkt door de RPC hierboven.
  supabase.functions.invoke('send-death-report-alert', {
    body: {
      deceasedEmail: row.deceased_email || details.deceasedEmail,
      reporterName: details.reporterName,
      relationship: details.relationship,
    },
  }).catch(err => console.error('send-death-report-alert aanroep mislukt', err));
  return { type: 'matched', deceasedName, hasCertificate, real: true };
}

// Kleine helper zodat elke ingelogde pagina dezelfde pagina-header layout deelt.
function pageHeader(opts) {
  const { kicker, title, sub } = opts;
  return `
    <div class="page-header">
      <span class="kicker">${esc(kicker)}</span>
      <h1>${title}</h1>
      <p>${sub}</p>
    </div>
  `;
}

// ---------- render ----------
function render() {
  const root = document.getElementById('app');
  let html;
  if (!state.account) {
    if (state.view === 'signup') html = renderSignup();
    else if (state.view === 'waitlist') html = renderWaitlist();
    else if (state.view === 'partner') html = renderPartner();
    else if (state.view === 'death-report') html = renderDeathReport();
    else html = renderLanding();
  } else {
    if (ui.onboardingStep > 0) {
      html = renderShell(renderOnboarding());
      root.innerHTML = html;
      wireEvents();
      return;
    }
    if (state.view === 'assets' && !personalInfoComplete()) {
      state.view = 'gegevens';
      saveState();
    }
    let content;
    switch (state.view) {
      case 'gegevens': content = renderPersonalInfo(); break;
      case 'assets': content = renderAssets(); break;
      case 'contacts': content = renderContacts(); break;
      case 'vault': content = renderVault(); break;
      case 'instructions': content = renderInstructions(); break;
      case 'report': content = renderReport(); break;
      case 'admin': content = renderAdmin(); break;
      default: content = renderDashboard();
    }
    html = renderShell(content);
  }
  root.innerHTML = html;
  wireEvents();
}

function finishOnboarding() {
  ui.onboardingStep = 0;
  localStorage.setItem('af_onboarding_done', '1');
  render();
}

function renderOnboarding() {
  const step = ui.onboardingStep;
  const STEPS = ['Jouw naam', 'Bezittingen', 'Contacten', 'Klaar'];
  const dots = STEPS.map((_, i) => {
    const cls = i + 1 === step ? 'ob-dot ob-dot--active' : i + 1 < step ? 'ob-dot ob-dot--done' : 'ob-dot';
    return '<span class="' + cls + '"></span>';
  }).join('');

  let body = '';
  if (step === 1) {
    body = `
      <div class="ob-icon">${iconSvg('shield-check', 36)}</div>
      <h2 class="ob-title">Welkom bij AfterFile</h2>
      <p class="ob-sub">We beginnen met je naam, zodat je dossier op de juiste persoon staat.</p>
      <form id="ob-form-1" class="ob-form">
        <div class="field">
          <label for="ob-fullname">Volledige naam</label>
          <input id="ob-fullname" type="text" name="fullName" placeholder="bijv. Jan de Vries" value="${esc(state.personalInfo?.fullName || '')}" required autofocus>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Opslaan en verder &rarr;</button>
      </form>
      <button class="ob-skip" data-action="ob-skip">Sla over en ga naar dashboard</button>
    `;
  } else if (step === 2) {
    body = `
      <div class="ob-icon">${iconSvg('folder', 36)}</div>
      <h2 class="ob-title">Jouw bezittingen</h2>
      <p class="ob-sub">Leg vast wat je hebt: bankrekeningen, crypto, e-mailaccounts en meer. Je naasten weten dan precies wat er is en waar het staat.</p>
      <button class="btn btn-primary btn-block btn-lg" data-action="ob-goto-assets">Ga naar Bezittingen &rarr;</button>
      <button class="ob-skip" data-action="ob-next">Nu overslaan</button>
    `;
  } else if (step === 3) {
    body = `
      <div class="ob-icon">${iconSvg('users', 36)}</div>
      <h2 class="ob-title">Vertrouwde contacten</h2>
      <p class="ob-sub">Wie neemt de regie over na jouw overlijden? Voeg minimaal één persoon toe die toegang krijgt tot jouw dossier.</p>
      <button class="btn btn-primary btn-block btn-lg" data-action="ob-goto-contacts">Ga naar Contacten &rarr;</button>
      <button class="ob-skip" data-action="ob-next">Nu overslaan</button>
    `;
  } else {
    body = `
      <div class="ob-icon ob-icon--success">${iconSvg('check', 36)}</div>
      <h2 class="ob-title">Je bent er klaar voor</h2>
      <p class="ob-sub">Je dossier staat klaar. Vul je bezittingen en contacten aan wanneer het jou uitkomt. Alles kun je later aanpassen.</p>
      <button class="btn btn-primary btn-block btn-lg" data-action="ob-finish">Naar mijn dashboard</button>
    `;
  }

  return `
    <div class="ob-wrap">
      <div class="ob-card">
        <div class="ob-dots">${dots}</div>
        <p class="ob-step-label">Stap ${step} van ${STEPS.length}</p>
        ${body}
      </div>
    </div>
  `;
}

function renderSiteFooter() {
  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <span class="site-footer-brand">
        <span class="brand-mark" style="display:inline-flex;vertical-align:middle;">${logoMark(20)}</span>
        <span style="font-weight:600;letter-spacing:-0.01em;">AfterFile</span>
      </span>
      <span class="site-footer-divider">·</span>
      <span>${esc(TRUST_LINE)}</span>
      <span class="site-footer-divider">·</span>
      <a href="#" data-nav="privacy" style="color:inherit;">Privacyverklaring</a>
      <span class="site-footer-divider">·</span>
      <span>© ${new Date().getFullYear()} AfterFile</span>
    </div>
  </footer>`;
}

function renderLanding() {
  const checks = [
    'Bewaar je digitale bezittingen veilig',
    'Voeg vertrouwde contacten toe',
    'Leg duidelijke instructies vast',
    'Eén klik voor je Legacy Report (PDF)',
    'Alleen geverifieerde vrijgave, nooit automatisch',
    'Wij zien nooit wachtwoorden of private keys'
  ];
  const checkListHtml = checks.map(c => `<li>${iconSvg('check', 16)}<span>${esc(c)}</span></li>`).join('');

  const plansHtml = PLANS.map(p => `
    <div class="plan-card ${p.featured ? 'plan-card--featured' : ''}">
      ${p.featured ? '<span class="plan-badge">Meest gekozen</span>' : ''}
      <h3>${esc(p.name)}</h3>
      <div class="plan-price-row"><span class="plan-price">${esc(p.price)}</span><span class="plan-period">${esc(p.period)}</span></div>
      <p class="plan-billing">${esc(p.billing)}</p>
      ${p.launchEligible ? `<span class="plan-launch-note">${iconSvg('check', 12)} Eerste ${LAUNCH_OFFER_MONTHS} maanden gratis</span>` : ''}
      <ul class="plan-features">
        ${p.features.map(f => `<li>${iconSvg('check', 14)}<span>${esc(f)}</span></li>`).join('')}
        ${(p.missingFeatures || []).map(f => `<li style="color:var(--color-text-faint);">${iconSvg('x', 14)}<span>${esc(f)}</span></li>`).join('')}
      </ul>
      <button class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'} btn-block" data-nav="signup" data-plan="${p.key}">${esc(p.cta)}</button>
    </div>
  `).join('');

  const faqs = [
    { q: 'Wat is AfterFile?', a: 'AfterFile is een veilige, persoonlijke plek om je digitale nalatenschap te regelen: je bezittingen, accounts en instructies vastgelegd voor de mensen die je vertrouwt, voor het moment dat jij dat zelf niet meer kan.' },
    { q: 'Slaat AfterFile mijn wachtwoorden op?', a: 'Nee. AfterFile slaat nooit wachtwoorden, private keys of herstelcodes op. Je legt vast wát er is en waar het te vinden is, niet hoe je ergens inlogt.' },
    { q: 'Wanneer krijgen mijn vertrouwde contacten toegang?', a: 'Een contact met de rol "Helpen bevestigen" kan via de "Overlijden melden"-link op de AfterFile-website een melding indienen met een officieel overlijdensbericht. AfterFile controleert dit en geeft de gegevens vrij aan contacten met de rol "Informatie ontvangen", doorgaans binnen 1 werkdag.' },
    { q: 'Hoe meldt een vertrouwd contact een overlijden?', a: 'Via de link "Voor Naasten" in de menubalk. Daar vult het contact de naam en het e-mailadres in waarmee de overledene bij AfterFile bekend was, samen met zijn of haar eigen naam en contactgegevens, zodat dit gecontroleerd kan worden.' },
    { q: 'Kan ik op elk moment opzeggen?', a: 'Ja. Je kunt je abonnement op elk moment stopzetten. Je gegevens blijven veilig bewaard totdat je ze zelf verwijdert.' },
    { q: 'Is de cloud niet onveiliger dan opslaan op mijn eigen apparaat?', a: 'Nee, en voor digitale nalatenschap geldt juist het omgekeerde. Apps die alles lokaal opslaan lossen het technische opslagprobleem op, maar creëren een groter probleem: hoe krijgen je naasten ooit toegang tot een bestand op een apparaat dat zij niet kennen, niet kunnen ontgrendelen, of dat al jaren geleden kapot is gegaan? AfterFile versleutelt je gegevens in de cloud (AES-256) én koppelt vrijgave aan een gecontroleerde verificatieprocedure. Zo zijn je gegevens tijdens je leven beschermd tegen ongeoorloofde toegang, en na je overlijden gegarandeerd bereikbaar voor de juiste mensen. Lokale opslag is veilig voor jezelf. AfterFile is veilig voor wat er daarna komt.' },
    { q: 'Welke betaalmethoden worden ondersteund?', a: 'We ondersteunen iDEAL, Visa en Mastercard.' },
  ];
  const faqHtml = faqs.map((f, i) => `
    <div class="faq-item ${ui.openFaqIndex === i ? 'open' : ''}">
      <button type="button" class="faq-question" data-action="toggle-faq" data-index="${i}">
        <span>${esc(f.q)}</span>
        ${iconSvg('chevron-down', 18)}
      </button>
      <div class="faq-answer"><p>${esc(f.a)}</p></div>
    </div>
  `).join('');

  return `
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links">
          ${PRELAUNCH_MODE ? `<a href="#" data-nav="waitlist">Voor naasten</a>` : `<a href="#" data-nav="death-report">Voor naasten</a>`}
          <a href="#" data-nav="partner" style="font-weight:500;">Voor partners</a>
          <button class="btn btn-secondary btn-sm" data-nav="signup" data-plan="basis">Aanmelden</button>
          <button class="btn btn-primary btn-sm" data-nav="signup" data-plan="compleet">Nu abonneren</button>
        </div>
      </div>
    </nav>
    <main class="page">
      <div class="container">
        <div class="hero-split">
          <div class="hero-photo">
            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80" alt="Een glimlachend persoon, gerustgesteld dat alles geregeld is" loading="lazy" onerror="this.parentElement.classList.add('photo-fallback'); this.remove();">
            <div class="photo-callout">${iconSvg('check', 14)} Alles is geregeld</div>
          </div>
          <div class="hero-content">
            <div class="hero-kicker"><span class="brand-mark">${logoMark(27)}</span> AfterFile</div>
            <h1>Als jou iets overkomt, weten je dierbaren dan wat belangrijk is?</h1>
            <p class="hero-sub">Organiseer veilig je belangrijke digitale accounts, bezittingen en instructies voor de mensen die je vertrouwt.</p>
            <ul class="check-list">${checkListHtml}</ul>
            <div class="hero-cta-row">
              <button class="btn btn-primary btn-lg" data-nav="signup" data-plan="compleet">Aan de slag</button>
              <span class="hero-cta-note">Begin gratis, of upgrade met onze lanceringsaanbieding: de eerste ${LAUNCH_OFFER_MONTHS} maanden gratis op Compleet</span>
            </div>
          </div>
        </div>

        <div class="section-divider"></div>

        <section class="security-section">
          <div class="section-heading">
            <span class="kicker">Beveiliging</span>
            <h2>Je gegevens zijn nergens veiliger</h2>
            <p>Beveiliging staat voorop, het is de basis van een betrouwbare digitale nalatenschap.</p>
          </div>
          <div class="security-grid">
            <div class="security-card">
              <div class="card-icon">${iconSvg('shield-check', 18)}</div>
              <h3>Versleuteld, altijd</h3>
              <p>Al je gegevens worden versleuteld opgeslagen en verzonden, op servers binnen de EU.</p>
            </div>
            <div class="security-card">
              <div class="card-icon">${iconSvg('key-off', 18)}</div>
              <h3>Nooit wachtwoorden of keys</h3>
              <p>We vragen er nooit om en bewaren ze ook nooit: geen wachtwoorden, private keys of herstelcodes.</p>
            </div>
            <div class="security-card">
              <div class="card-icon">${iconSvg('eye-off', 18)}</div>
              <h3>Strikte toegangscontrole</h3>
              <p>Jij hebt altijd toegang. Je vertrouwde contacten krijgen toegang na verificatie van een officieel overlijdensbericht.</p>
            </div>
            <div class="security-card">
              <div class="card-icon">${iconSvg('ban', 18)}</div>
              <h3>Geen verkoop, geen tracking</h3>
              <p>We verkopen of delen je gegevens nooit met derden, en gebruiken ze nooit voor advertenties.</p>
            </div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section class="pricing-section">
          <div class="section-heading">
            <span class="kicker">Pakketten</span>
            <h2>Kies het pakket dat bij je past</h2>
            <p>Begin gratis, of kies direct voor volledige bescherming.</p>
          </div>
          <div class="launch-banner">${iconSvg('check', 14)} Lanceringsaanbieding: de eerste ${LAUNCH_OFFER_MONTHS} maanden gratis op Compleet. Geen verplichtingen, op elk moment stop te zetten.</div>
          <div class="pricing-grid">${plansHtml}</div>
          <p class="control-line">${iconSvg('lock', 13)} Overzicht voor jezelf. Rust voor wie je lief is. Dat is AfterFile.</p>
          <p class="payment-row">Visa · Mastercard · iDEAL</p>
        </section>

        <div class="section-divider"></div>

        <section class="partner-landing-section">
          <div class="partner-landing-inner">
            <div class="partner-landing-left">
              <span class="kicker">Voor professionals</span>
              <h2>Bent u notaris of advocaat?</h2>
              <p>Word exclusief partner van AfterFile in uw regio.</p>
              <a href="#" class="btn btn-secondary" data-nav="partner" style="display:inline-flex;align-items:center;gap:6px;margin-top:4px;">Meer informatie voor partners ${iconSvg('chevron-right', 15)}</a>
            </div>
            <div class="partner-landing-right">
              <div class="partner-usp">${iconSvg('shield-check', 16)} <span><strong>Exclusief per regio</strong>, maximaal één notariskantoor en één advocatenkantoor</span></div>
              <div class="partner-usp">${iconSvg('shield-check', 16)} <span><strong>Gratis in de startfase</strong>, in ruil voor promotie bij uw cliënten</span></div>
              <div class="partner-usp">${iconSvg('shield-check', 16)} <span><strong>Eigen verwijslink</strong>, direct inzetbaar in nieuwsbrief of op website</span></div>
            </div>
          </div>
        </section>

        <div class="section-divider"></div>

        <section class="faq-section">
          <div class="section-heading">
            <span class="kicker">Veelgestelde vragen</span>
            <h2>Nog vragen?</h2>
          </div>
          <div class="faq-list">${faqHtml}</div>
        </section>
      </div>
    </main>
    ${renderSiteFooter()}
  `;
}

// Statuspaneel onder het meldformulier op de landingspagina: toont het resultaat van de
// laatst ingediende melding (gevonden/al lopend/al gedeeld/niet gevonden). Hergebruikt
// bewust de .checkin-card/.status-pill stijlen die eerder voor de (nu verwijderde)
// statuskaart op de Contacten-pagina werden gebruikt.
function renderDeathReportResult() {
  const r = ui.deathReportResult;
  if (!r) return '';
  let cls, label, detail;
  let showDemoBtn = false;
  if (r.type === 'error') {
    cls = 'danger';
    label = 'Versturen mislukt';
    detail = 'Er ging iets mis bij het versturen van je melding. Probeer het straks nog eens.';
  } else if (r.type === 'not-found') {
    cls = 'danger';
    label = 'Geen account gevonden';
    detail = 'We konden geen account vinden met het e-mailadres dat je hebt opgegeven voor de overledene. Controleer of dit klopt en probeer het opnieuw.';
  } else if (r.type === 'already-waiting') {
    cls = 'warn';
    label = 'Melding al ingediend';
    detail = `Er is al eerder een melding ingediend voor ${esc(r.deceasedName)}. AfterFile is bezig met de verificatie.`;
    showDemoBtn = !r.real;
  } else if (r.type === 'already-shared') {
    cls = 'danger';
    label = 'Informatie al gedeeld';
    detail = `De vastgelegde gegevens van ${esc(r.deceasedName)} zijn al gedeeld met de vertrouwde contacten.`;
  } else if (r.type === 'shared-now') {
    cls = 'danger';
    label = 'Informatie gedeeld';
    detail = `De verificatie is afgerond. De vastgelegde gegevens van ${esc(r.deceasedName)} zijn nu gedeeld met de contacten die de rol "Informatie ontvangen" hebben.`;
  } else {
    cls = 'ok';
    label = 'Melding ontvangen';
    detail = `We hebben een account gevonden voor ${esc(r.deceasedName)}. Jouw melding en de bijgevoegde akte van overlijden worden door AfterFile gecontroleerd. Doorgaans geven we de gegevens <strong>binnen 1 werkdag</strong> vrij.`;
    showDemoBtn = !r.real;
  }
  return `
    <div class="checkin-card status-${cls}">
      <div class="checkin-card-top">
        <h3>Status van je melding</h3>
        <span class="status-pill status-${cls}">${esc(label)}</span>
      </div>
      <p>${detail}</p>
      ${showDemoBtn ? `<div class="checkin-card-actions"><button type="button" class="btn btn-secondary btn-sm" data-action="sim-death-wait-elapsed" data-id="${esc(r.signupId)}">Simuleer einde wachttijd (demo)</button></div>` : ''}
    </div>
  `;
}

// Los, niet-openbaar bereikbaar onderdeel: alleen via de "Overlijden melden"-link in de
// header te bereiken (data-nav="death-report"), staat dus niet meer als sectie onderaan de
// landingspagina. Vanuit hier kan altijd weer terug naar de landingspagina via Home/het logo.
function renderDeathReport() {
  const relationshipOptionsHtmlForDeathForm = RELATIONSHIP_SUGGESTIONS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  return `
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links"><a href="#" data-nav="landing">Home</a></div>
      </div>
    </nav>
    <main class="page">
      <div class="container">
        <section class="report-death-section" id="meld-overlijden">
          <div class="section-heading">
            <span class="kicker">Voor vertrouwde contacten</span>
            <h2>Melding maken van overlijden?</h2>
            <p>Ben je door iemand toegevoegd als vertrouwd contact en is die persoon overleden? Meld dat hier. We vragen om voldoende gegevens om dit te kunnen verifiëren.</p>
          </div>
          <div class="inline-form-card report-death-card">
            <form id="death-report-form">
              <h4 class="report-death-subheading">Over de overledene</h4>
              <div class="field-row">
                <div class="field ${ui.deathReportErrors && ui.deathReportErrors.deceasedName ? 'invalid' : ''}">
                  <label for="dr-deceased-name">Naam</label>
                  <input id="dr-deceased-name" name="deceasedName" type="text" placeholder="Volledige naam">
                </div>
                <div class="field ${ui.deathReportErrors && ui.deathReportErrors.deceasedEmail ? 'invalid' : ''}">
                  <label for="dr-deceased-email">E-mailadres bij AfterFile</label>
                  <input id="dr-deceased-email" name="deceasedEmail" type="email" placeholder="naam@voorbeeld.nl">
                </div>
              </div>

              <h4 class="report-death-subheading">Jouw contactgegevens (ter verificatie)</h4>
              <div class="field-row">
                <div class="field ${ui.deathReportErrors && ui.deathReportErrors.reporterName ? 'invalid' : ''}">
                  <label for="dr-reporter-name">Jouw naam</label>
                  <input id="dr-reporter-name" name="reporterName" type="text" placeholder="Jouw volledige naam">
                </div>
                <div class="field ${ui.deathReportErrors && ui.deathReportErrors.reporterEmail ? 'invalid' : ''}">
                  <label for="dr-reporter-email">Jouw e-mailadres</label>
                  <input id="dr-reporter-email" name="reporterEmail" type="email" placeholder="jouw@voorbeeld.nl">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="dr-reporter-phone">Jouw telefoonnummer <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
                  <input id="dr-reporter-phone" name="reporterPhone" type="tel" placeholder="bijv. 06 12345678">
                </div>
                <div class="field">
                  <label for="dr-relationship">Jouw relatie tot deze persoon <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
                  <select id="dr-relationship" name="relationship">
                    ${relationshipOptionsHtmlForDeathForm}
                    <option value="">Anders…</option>
                  </select>
                  <input id="dr-relationship-other" name="relationship-other" type="text" placeholder="Vul je eigen relatie in" style="display:none; margin-top:10px;">
                </div>
              </div>
              <div class="field">
                <label for="dr-message">Toelichting <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
                <textarea id="dr-message" name="message" rows="3" placeholder="Eventueel extra context, bijvoorbeeld hoe je dit weet."></textarea>
              </div>

              <div class="field certificate-upload-field ${ui.deathReportErrors && ui.deathReportErrors.certificate ? 'invalid' : ''}">
                <label for="dr-certificate">Akte van overlijden</label>
                <input id="dr-certificate" name="certificate" type="file" accept=".pdf,.jpg,.jpeg,.png" style="margin-top:6px;" required>
                <div class="field-hint" style="margin-top:6px;">
                  Upload een scan of foto van de akte van overlijden. AfterFile controleert dit en geeft de gegevens vrij, doorgaans <strong>binnen 1 werkdag</strong>.<br>
                  Toegestaan: PDF, JPG, PNG · max. 5 MB.
                </div>
              </div>

              ${(ui.deathReportErrors && Object.keys(ui.deathReportErrors).length) ? `<p class="field-error">Vul je naam en e-mailadres in, en een geldig e-mailadres voor de overledene.</p>` : ''}
              ${(ui.deathReportErrors && ui.deathReportErrors.certificate) ? `<p class="field-error">${esc(ui.deathReportErrors.certificate)}</p>` : ''}
              <div class="form-actions">
                <button type="submit" class="btn btn-secondary" ${ui.deathReportSubmitting ? 'disabled' : ''}>${ui.deathReportSubmitting ? 'Bezig…' : 'Melding versturen'}</button>
              </div>
            </form>
          </div>
          ${renderDeathReportResult()}
        </section>
      </div>
    </main>
  `;
}

function renderSignup() {
  const planKey = ui.selectedPlanKey || 'compleet';
  const plan = PLANS.find(p => p.key === planKey) || PLANS[1];
  const emailError = ui.signupEmailError;
  const betalingOpen = !!ui.betalingOpen;

  if (ui.magicLinkSentTo) {
    return `
      <nav class="publicnav">
        <div class="publicnav-inner">
          <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
          <div class="publicnav-links"><a href="#" data-nav="landing">Home</a></div>
        </div>
      </nav>
      <main class="page">
        <div class="container checkout-container">
          <div class="checkin-card status-ok">
            <div class="checkin-card-top">
              <h3>Check je e-mail</h3>
              <span class="status-pill status-ok">Verzonden</span>
            </div>
            <p>We hebben een inloglink gestuurd naar <strong>${esc(ui.magicLinkSentTo)}</strong>. Klik op de link in die e-mail om verder te gaan, er is geen wachtwoord nodig.</p>
          </div>
        </div>
      </main>
    `;
  }

  const paymentBadgesHtml = PAYMENT_METHODS.map(m => `<span class="payment-badge">${esc(m)}</span>`).join('');
  const planOptionsHtml = PLANS.map(p => `<option value="${p.key}" ${p.key === planKey ? 'selected' : ''}>${esc(p.name)}, ${esc(p.price)}${esc(p.period)}${p.launchEligible ? ` (eerste ${LAUNCH_OFFER_MONTHS} mnd gratis)` : ''}</option>`).join('');

  return `
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links"><a href="#" data-nav="landing">Home</a></div>
      </div>
    </nav>
    <main class="page">
      <div class="container checkout-container">
        <div class="checkout-grid">
          <div class="checkout-main">
            <form id="signup-form" novalidate>
              <div class="checkout-step">
                <h2 class="checkout-step-title">1. Uw e-mailadres <span class="info-dot" title="Je e-mailadres wordt gebruikt om in te loggen en voor herinneringen.">${iconSvg('info', 17)}</span></h2>
                <div class="field ${emailError ? 'invalid' : ''}">
                  <input id="su-email" name="email" type="email" placeholder="E-mailadres" autocomplete="email" autofocus>
                </div>
                ${emailError ? `<p class="field-error">${esc(emailError)}</p>` : ''}
              </div>
              <div class="checkout-actions">
                <button type="submit" class="btn btn-primary btn-lg" ${ui.signupSubmitting ? 'disabled' : ''}>${ui.signupSubmitting ? 'Bezig…' : 'Doorgaan'}</button>
              </div>

              <div class="section-divider checkout-divider"></div>

              <div class="checkout-step betaling ${betalingOpen ? 'open' : ''}">
                <button type="button" class="checkout-step-toggle" data-action="toggle-betaling">
                  <span class="checkout-step-title">2. Betaling <span class="lock-ico">${iconSvg('lock', 15)}</span></span>
                  <span class="payment-badges">${paymentBadgesHtml}</span>
                  ${iconSvg('chevron-down', 18)}
                </button>
                <div class="checkout-betaling-body">
                  <div class="field">
                    <label for="su-name">Je naam <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
                    <input id="su-name" name="name" type="text" placeholder="Sven Bakker" autocomplete="name">
                  </div>
                  ${plan.key !== 'basis' ? `
                  <div class="field">
                    <label>Betaalperiode</label>
                    <div class="billing-period-options">
                      <label class="billing-period-option ${ui.billingPeriod === 'year' ? 'selected' : ''}">
                        <input type="radio" name="billing-period" value="year" ${ui.billingPeriod === 'year' ? 'checked' : ''}>
                        <span class="billing-period-label">
                          <span class="billing-period-name">Jaarlijks</span>
                          <span class="billing-period-price">€39,95 / jaar</span>
                          <span class="billing-period-save">Bespaar 16%</span>
                        </span>
                      </label>
                      <label class="billing-period-option ${ui.billingPeriod === 'month' ? 'selected' : ''}">
                        <input type="radio" name="billing-period" value="month" ${ui.billingPeriod === 'month' ? 'checked' : ''}>
                        <span class="billing-period-label">
                          <span class="billing-period-name">Maandelijks</span>
                          <span class="billing-period-price">€3,95 / maand</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  ` : ''}
                  <p class="payment-note" style="text-align:left; margin-top:0;">${plan.key === 'basis'
                    ? 'Het Basis-pakket is gratis: er is geen betaalstap nodig.'
                    : `Klik op "Doorgaan", bevestig je e-mailadres via de link die je ontvangt, en je wordt direct daarna automatisch doorgestuurd naar Stripe om veilig te betalen (creditcard of iDEAL). De eerste ${LAUNCH_OFFER_MONTHS} maanden zijn gratis; daarna wordt het abonnement automatisch verlengd via SEPA-incasso, tot je opzegt.`}</p>
                </div>
              </div>
            </form>
          </div>

          <aside class="checkout-summary">
            <div class="summary-card">
              ${plan.launchEligible ? `<div class="summary-launch-banner">${iconSvg('check', 13)} Lanceringsaanbieding: eerste ${LAUNCH_OFFER_MONTHS} maanden gratis</div>` : ''}
              <div class="summary-plan-row">
                <div>
                  <h3>${esc(plan.name)}</h3>
                  <p class="summary-billing">${plan.key === 'compleet'
                    ? (ui.billingPeriod === 'month' ? 'Maandelijks opzegbaar' : 'Jaarlijks gefactureerd, bespaar 16%')
                    : (plan.launchEligible ? `Daarna: ${esc(plan.billing)}` : esc(plan.billing))}</p>
                </div>
                <div class="summary-price-col">
                  ${plan.launchEligible ? `<div class="summary-price-old">${plan.key === 'compleet' && ui.billingPeriod === 'month' ? '€3,95 / maand' : `${esc(plan.price)}${esc(plan.period)}`}</div>` : ''}
                  <div class="summary-price">${plan.launchEligible ? '€0' : (plan.key === 'compleet' ? (ui.billingPeriod === 'month' ? '€3,95' : '€39,95') : esc(plan.price))}<span>${plan.launchEligible ? '/ maand' : (plan.key === 'compleet' ? (ui.billingPeriod === 'month' ? '/ maand' : '/ jaar') : esc(plan.period))}</span></div>
                </div>
              </div>
              <div class="summary-change-plan">
                <select id="select-plan" aria-label="Pakket wijzigen">${planOptionsHtml}</select>
                <span class="summary-change-plan-ico">${iconSvg('chevron-down', 16)}</span>
              </div>

              <div class="summary-plan-features">
                <h4>Inbegrepen bij ${esc(plan.name)}</h4>
                <ul>
                  ${plan.features.map(f => `<li>${iconSvg('check', 13)}<span>${esc(f)}</span></li>`).join('')}
                </ul>
              </div>

              <div class="summary-divider"></div>

              <div class="summary-terms">
                <h4>Over je abonnement</h4>
                <ul>
                  <li>Je kunt je abonnement op elk moment stopzetten via je dashboard.</li>
                  <li>Niet tevreden? Binnen 30 dagen na aankoop krijg je het volledige bedrag terug.</li>
                </ul>
              </div>

              <div class="summary-divider"></div>

              <div class="summary-subtotal-row">
                <span>Subtotaal (incl. btw)</span>
                <strong>${plan.launchEligible ? '€0' : esc(plan.price)}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  `;
}

// Vóór de lancering vervangt deze pagina de volledige betaalflow: alleen naam + e-mail,
// geen plan- of betaalstap. De bestaande renderSignup()/checkout-code hierboven blijft
// ongewijzigd en wordt na lancering simpelweg weer bereikbaar door PRELAUNCH_MODE op
// false te zetten (zie wireEvents, data-nav handler).
const PARTNER_REGIO_OPTIES = [
  "Amsterdam","Rotterdam","Den Haag","Utrecht Stad en Omgeving",
  "Amersfoort en Heuvelrug","Gooi, Flevoland en Almere","Zaanstreek en Waterland",
  "Kennemerland","Noord-Holland Noord","Leiden en Bollenstreek",
  "Haaglanden","Rijnmond","Dordrecht en Drechtsteden","Zeeland",
  "West-Brabant","Breda en Tilburg","'s-Hertogenbosch en Land van Cuijk",
  "Eindhoven en De Kempen","Noord-Limburg en Peelland","Nijmegen en Rivierenland",
  "Arnhem en Veluwe","Achterhoek","Stedendriehoek en Salland","Twente",
  "Zwolle en Vechtdal","Drenthe","Groningen","Friesland",
  "Midden-Limburg","Zuid-Limburg",
];

function renderWaitlist() {
  const slug = partnerRef.toLowerCase();
  const autoReferral = slug.includes('notaris') ? 'notaris'
    : slug.includes('advocaat') ? 'advocaat'
    : '';

  const waitlistContent = ui.magicLinkSentTo ? `
    <div class="checkin-card status-ok">
      <div class="checkin-card-top">
        <h3>Check je e-mail</h3>
        <span class="status-pill status-ok">Verzonden</span>
      </div>
      <p>We hebben een inloglink gestuurd naar <strong>${esc(ui.magicLinkSentTo)}</strong>. Klik op de link in die e-mail om in te loggen, er is geen wachtwoord nodig.</p>
    </div>
  ` : ui.waitlistJoined ? `
    <div class="checkin-card status-ok">
      <div class="checkin-card-top">
        <h3>Je staat op de wachtlijst</h3>
        <span class="status-pill status-ok">Aangemeld</span>
      </div>
      <p>We laten je via e-mail weten zodra AfterFile live gaat. Als wachtlijst-lid krijg je de eerste ${LAUNCH_OFFER_MONTHS} maanden gratis.</p>
    </div>
  ` : `
    <div class="checkout-step">
      <h2 class="checkout-step-title">Schrijf je in voor de wachtlijst</h2>
      <p style="color:var(--color-text-muted); margin-top:-4px;">We lanceren binnenkort. Meld je nu aan voor je digitale nalatenschap en je krijgt als eerste toegang, plus ${LAUNCH_OFFER_MONTHS} maanden gratis.</p>
    </div>
    <form id="waitlist-form" novalidate>
      <div class="field">
        <label for="wl-name">Naam</label>
        <input id="wl-name" name="name" type="text" placeholder="Jouw naam" autocomplete="name" required autofocus>
      </div>
      <div class="field ${ui.waitlistEmailError ? 'invalid' : ''}">
        <label for="wl-email">E-mailadres</label>
        <input id="wl-email" name="email" type="email" placeholder="naam@voorbeeld.nl" autocomplete="email" required>
      </div>
      ${ui.waitlistEmailError ? `<p class="field-error">${esc(ui.waitlistEmailError)}</p>` : ''}
      <div class="field">
        <label for="wl-referral">Hoe heeft u AfterFile gevonden?</label>
        <select id="wl-referral" name="referral_source">
          <option value="" disabled ${!autoReferral ? 'selected' : ''}>Maak een keuze...</option>
          <option value="notaris" ${autoReferral === 'notaris' ? 'selected' : ''}>Via een notaris</option>
          <option value="advocaat" ${autoReferral === 'advocaat' ? 'selected' : ''}>Via een advocaat</option>
          <option value="social" ${autoReferral === 'social' ? 'selected' : ''}>Via social media (LinkedIn / X)</option>
          <option value="vriend" ${autoReferral === 'vriend' ? 'selected' : ''}>Via vriend of familie</option>
          <option value="anders">Anders, namelijk...</option>
        </select>
      </div>
      <div class="field" id="wl-referral-other-wrap" style="display:none">
        <label for="wl-referral-other">Namelijk</label>
        <input id="wl-referral-other" name="referral_other" type="text" placeholder="Bijv. via Google, via een beurs...">
      </div>
      <div class="checkout-actions">
        <button type="submit" class="btn btn-primary btn-lg">Op de wachtlijst</button>
      </div>
    </form>
  `;



  return `
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links"><a href="#" data-nav="landing">Home</a></div>
      </div>
    </nav>
    <main class="page">
      <div class="container checkout-container">
        ${partnerRef ? `
        <div class="partner-banner">
          <span class="partner-banner-icon">${icon('shield', 18)}</span>
          <div>
            <strong>Uitgenodigd door ${esc(partnerRef)}</strong>
            <span>, welkom bij AfterFile. Schrijf je hieronder in voor de wachtlijst.</span>
          </div>
        </div>` : ''}
        <div class="checkout-grid">
          <div class="checkout-main">
            ${waitlistContent}
          </div>
        </div>
      </div>
    </main>
  `;
}


function renderPartner() {
  return `
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links">
          <a href="#" data-nav="landing">Home</a>
          <a href="#" class="nav-active" data-nav="partner">Voor partners</a>
        </div>
      </div>
    </nav>
    <main class="page">
      <div class="container checkout-container">
        <div class="checkout-grid">
          <div class="checkout-main">
            ${ui.partnerFormSent ? `
              <div class="checkin-card status-ok">
                <div class="checkin-card-top">
                  <h3>Aanvraag ontvangen</h3>
                  <span class="status-pill status-ok">Verstuurd</span>
                </div>
                <p>Bedankt voor uw interesse. We nemen binnen twee werkdagen contact met u op om de mogelijkheden voor uw regio te bespreken.</p>
              </div>
            ` : `
              <div class="checkout-step">
                <h2 class="checkout-step-title">Partner worden</h2>
                <p style="color:var(--color-text-muted);margin-top:-4px;margin-bottom:20px;">Als notariskantoor of advocatenkantoor kunt u exclusief partner worden van AfterFile in uw regio.</p>
              </div>
              ${ui.partnerFormError ? `<p class="field-error" style="margin-bottom:12px;">${esc(ui.partnerFormError)}</p>` : ''}
              <form id="partner-form" novalidate>
                <div class="field">
                  <label for="pf-kantoor">Naam kantoor</label>
                  <input id="pf-kantoor" name="kantoor" type="text" placeholder="bijv. Notariskantoor Jansen" required>
                </div>
                <div class="field">
                  <label for="pf-contactpersoon">Contactpersoon</label>
                  <input id="pf-contactpersoon" name="contactpersoon" type="text" placeholder="Voor- en achternaam" required>
                </div>
                <div class="field">
                  <label for="pf-email">E-mailadres</label>
                  <input id="pf-email" name="email" type="email" placeholder="naam@kantoor.nl" required>
                </div>
                <div class="field">
                  <label for="pf-type">Type kantoor</label>
                  <select id="pf-type" name="type" required>
                    <option value="" disabled selected>Kies type...</option>
                    <option value="notaris">Notariskantoor</option>
                    <option value="advocaat">Advocatenkantoor (erfrecht / familierecht)</option>
                  </select>
                </div>
                <div class="field">
                  <label for="pf-regio">Gewenste regio</label>
                  <select id="pf-regio" name="regio" required>
                    <option value="" disabled selected>Kies regio...</option>
                    ${PARTNER_REGIO_OPTIES.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
                  </select>
                </div>
                <div class="checkout-actions">
                  <button type="submit" class="btn btn-primary btn-lg">Meer informatie ontvangen</button>
                </div>
              </form>
            `}
          </div>
        </div>
      </div>
    </main>
  `;
}

function renderShell(content) {
  const v = state.view;
  const navLink = (key, label) => `<a href="#" class="nav-link ${v === key ? 'active' : ''}" data-nav="${key}">${label}</a>`;
  return `
    <nav class="topnav">
      <div class="topnav-inner">
        <a href="#" class="brand" data-nav="dashboard"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="nav-links">
          ${navLink('dashboard', 'Dashboard')}
          ${navLink('assets', 'Bezittingen')}
          ${navLink('contacts', 'Contacten')}
          <a href="#" class="nav-link vault-nav-link${state.view === 'vault' ? ' active' : ''}" data-nav="vault">${ui.vaultState === 'unlocked' ? iconSvg('unlock', 14) : iconSvg('lock', 14)} Kluis</a>
        </div>
        ${renderAccountMenu(v)}
      </div>
    </nav>
    <main class="page">
      <div class="container">${content}</div>
    </main>
    ${renderSiteFooter()}
    ${renderContactInviteModal()}
  `;
}

// Account-naam fungeert als dropdown-trigger: de minder vaak gebruikte pagina's
// (Mijn gegevens, Instructies, Rapport, Beheer) plus Uitloggen staan hierin, zodat
// de header niet meer alle 7 navigatie-items in één rij hoeft te tonen.
function renderAccountMenu(activeView) {
  const menuLink = (key, label) => `<a href="#" class="account-menu-link ${activeView === key ? 'active' : ''}" data-nav="${key}">${label}</a>`;
  const open = ui.accountMenuOpen;
  return `
    <div class="account-menu ${open ? 'open' : ''}">
      <button type="button" class="account-menu-trigger" data-action="toggle-account-menu">
        <span class="nav-account-name">${esc(state.account.name)}</span>
        ${iconSvg('chevron-down', 16)}
      </button>
      ${open ? `
        <div class="account-menu-overlay"></div>
        <div class="account-menu-panel">
          ${menuLink('gegevens', 'Mijn gegevens')}
          ${menuLink('instructions', 'Instructies')}
          ${menuLink('report', 'Rapport')}
          ${state.account && state.account.role === 'owner' ? menuLink('admin', 'Beheer') : ''}
          <div class="account-menu-divider"></div>
          <button type="button" class="account-menu-link account-menu-logout" data-action="logout">Uitloggen</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderDashboard() {
  const pct = computeCompletion();
  const a = state.assets.length, c = state.contacts.length, hasInstr = state.instructions.trim().length > 0;
  const infoComplete = personalInfoComplete();
  const ASSET_TARGET = 1, CONTACT_TARGET = 1;
  const todo = [];
  if (!infoComplete) todo.push({ label: 'Vul je persoonsgegevens aan', nav: 'gegevens' });
  if (a < ASSET_TARGET) { const n = ASSET_TARGET - a; todo.push({ label: `Voeg nog ${n} bezitting${n === 1 ? '' : 'en'} toe`, nav: 'assets' }); }
  if (c < CONTACT_TARGET) { const n = CONTACT_TARGET - c; todo.push({ label: `Voeg nog ${n} vertrouwd contact${n === 1 ? '' : 'en'} toe`, nav: 'contacts' }); }

  // De voltooiingskaart is een tijdelijke bevestiging: zodra het plan voor het eerst 100% compleet
  // is, onthouden we het moment, en laten we de kaart na een paar minuten weer verdwijnen.
  if (pct >= 100 && !state.completedAt) {
    state.completedAt = Date.now();
    if (supabase) supabase.from('profiles').update({ completed_at: new Date(state.completedAt).toISOString() }).eq('id', state.account.id).then(() => {});
  } else if (pct < 100 && state.completedAt) {
    state.completedAt = null;
    if (supabase) supabase.from('profiles').update({ completed_at: null }).eq('id', state.account.id).then(() => {});
  }
  const justCompleted = pct >= 100 && !!state.completedAt && (Date.now() - state.completedAt) < COMPLETION_CONFIRM_MS;
  const showCompletionCard = pct < 100 || justCompleted;

  clearTimeout(completionHideTimer);
  if (justCompleted) {
    const remaining = COMPLETION_CONFIRM_MS - (Date.now() - state.completedAt);
    completionHideTimer = setTimeout(() => { if (state.view === 'dashboard') render(); }, Math.max(remaining, 0) + 50);
  }

  const heading = pct >= 100 ? 'Je eerste nalatenschap is 100% compleet.' : `Je nalatenschapsplan is voor ${pct}% compleet.`;
  const completionMsg = pct >= 100
    ? 'Goed zo. Je dierbaren weten straks precies wat ze moeten doen.'
    : 'Dit moet je nog doen om op 100% te komen:';
  const todoHtml = todo.length ? `<ul class="completion-todo">${todo.map(t => `<li><a href="#" data-nav="${t.nav}">${esc(t.label)} →</a></li>`).join('')}</ul>` : '';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - pct / 100);
  const firstName = getFirstName();

  // Self-serve upgrade voor Basis-gebruikers — dekt twee gevallen: iemand die bij signup al
  // voor Basis koos en later toch wil upgraden, én herstel als de automatische redirect naar
  // Stripe na het kiezen van een betaald plan (zie maybeStartCheckout()) ooit onderbroken werd.
  const upgradeBannerHtml = (state.account.plan === 'basis') ? `
    <div class="upgrade-banner">
      <div class="upgrade-banner-text">
        <h3>Haal meer uit AfterFile</h3>
        <p>Upgrade naar Compleet voor onbeperkt bezittingen, een volledig Legacy Report (PDF) en meer vertrouwde contacten. De eerste ${LAUNCH_OFFER_MONTHS} maanden zijn gratis.</p>
      </div>
      <div class="upgrade-banner-actions">
        ${PLANS.filter(p => p.launchEligible).map(p => `
          <button type="button" class="btn ${p.featured ? 'btn-primary' : 'btn-secondary'}" data-action="upgrade-plan" data-plan="${p.key}" ${ui.checkoutRedirecting ? 'disabled' : ''}>${ui.checkoutRedirecting ? 'Bezig…' : `Naar ${esc(p.name)} (${esc(p.price)}${esc(p.period)})`}</button>
        `).join('')}
      </div>
    </div>
  ` : '';

  const changePlanBannerHtml = '';

  const completionCardHtml = showCompletionCard ? `
    <div class="completion-card">
      <div class="completion-text">
        <h2>${heading}</h2>
        <p>${esc(completionMsg)}</p>
        ${todoHtml}
      </div>
      <div class="progress-ring-wrap">
        <svg width="96" height="96">
          <circle cx="48" cy="48" r="40" stroke="#E5E9F0" stroke-width="10" fill="none"></circle>
          <circle cx="48" cy="48" r="40" stroke="#5B8DEF" stroke-width="10" fill="none"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>
        </svg>
        <div class="progress-ring-label">${pct}%</div>
      </div>
    </div>
  ` : '';
  const currentPlan = PLANS.find(p => p.key === state.account.plan);
  const currentPlanHtml = currentPlan ? `
    <div class="current-plan-row">
      <span class="badge-pill">${esc(currentPlan.name)}</span>
      <span>jouw huidige abonnement</span>
    </div>
  ` : '';

  return `
    ${pageHeader({ kicker: 'Dashboard', title: `Welkom terug, ${esc(firstName)}`, sub: 'Dit is hoe je plan er vandaag voor staat.' })}

    ${currentPlanHtml}

    ${upgradeBannerHtml}

    ${changePlanBannerHtml}

    ${completionCardHtml}

    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-top">
          <div class="dash-card-title"><span class="card-icon">${iconSvg('info', 17)}</span><h3>Mijn gegevens</h3></div>
          <span class="check ${infoComplete ? 'done' : ''}">${infoComplete ? iconSvg('check', 12) : ''}</span>
        </div>
        <div class="count" style="font-size:18px;">${infoComplete ? 'Volledig' : 'Nog niet volledig'}</div>
        <a class="card-link" href="#" data-nav="gegevens">${infoComplete ? 'Gegevens bewerken →' : 'Gegevens invullen →'}</a>
      </div>
      <div class="dash-card">
        <div class="dash-card-top">
          <div class="dash-card-title"><span class="card-icon">${iconSvg('folder', 17)}</span><h3>Digitale bezittingen</h3></div>
          <span class="check ${a > 0 ? 'done' : ''}">${a > 0 ? iconSvg('check', 12) : ''}</span>
        </div>
        <div class="count">${a} <span class="unit">toegevoegd</span></div>
        <a class="card-link" href="#" data-nav="assets">Bezitting toevoegen →</a>
      </div>
      <div class="dash-card">
        <div class="dash-card-top">
          <div class="dash-card-title"><span class="card-icon">${iconSvg('users', 17)}</span><h3>Vertrouwde contacten</h3></div>
          <span class="check ${c > 0 ? 'done' : ''}">${c > 0 ? iconSvg('check', 12) : ''}</span>
        </div>
        <div class="count">${c} <span class="unit">toegevoegd</span></div>
        <a class="card-link" href="#" data-nav="contacts">Contact toevoegen →</a>
      </div>
      <div class="dash-card">
        <div class="dash-card-top">
          <div class="dash-card-title"><span class="card-icon">${iconSvg('file-text', 17)}</span><h3>Instructies</h3></div>
          <span class="check ${hasInstr ? 'done' : ''}">${hasInstr ? iconSvg('check', 12) : ''}</span>
        </div>
        <div class="count" style="font-size:18px;">${hasInstr ? 'Geschreven' : 'Nog niet geschreven'}</div>
        <a class="card-link" href="#" data-nav="instructions">${hasInstr ? 'Instructies bewerken →' : 'Instructies schrijven →'}</a>
      </div>
    </div>
  `;
}

function renderPersonalInfo() {
  const p = state.personalInfo || {};
  const complete = personalInfoComplete();
  return `
    ${pageHeader({ kicker: 'Mijn gegevens', title: 'Leg je persoonsgegevens vast.', sub: 'We gebruiken dit om jouw plan aan jou te koppelen en op te nemen in je Legacy Report.' })}
    ${!complete ? `<div class="info-banner">${iconSvg('info', 16)}<span>Vul je gegevens hieronder volledig in, dit is nodig voordat je een bezitting kunt toevoegen.</span></div>` : ''}
    <div class="inline-form-card">
      <div class="form-title">Persoonlijke gegevens</div>
      <form id="personal-info-form">
        <div class="field-row">
          <div class="field">
            <label for="pi-fullname">Volledige naam</label>
            <input id="pi-fullname" name="fullName" type="text" placeholder="bijv. Sven Bakker" value="${esc(p.fullName)}" required autofocus>
          </div>
          <div class="field">
            <label for="pi-birthdate">Geboortedatum</label>
            <input id="pi-birthdate" name="birthDate" type="text" inputmode="numeric" placeholder="DD-MM-JJJJ" pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}" value="${esc(toNlDate(p.birthDate))}" required>
          </div>
        </div>
        <div class="field">
          <label for="pi-street">Straat en huisnummer</label>
          <input id="pi-street" name="street" type="text" placeholder="bijv. Hoofdstraat 12" value="${esc(p.street)}" required>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="pi-postal">Postcode</label>
            <input id="pi-postal" name="postalCode" type="text" placeholder="bijv. 1234 AB" value="${esc(p.postalCode)}" required>
          </div>
          <div class="field">
            <label for="pi-city">Woonplaats</label>
            <input id="pi-city" name="city" type="text" placeholder="bijv. Amsterdam" value="${esc(p.city)}" required>
          </div>
        </div>
        <div class="field">
          <label for="pi-phone">Telefoonnummer</label>
          <input id="pi-phone" name="phone" type="tel" placeholder="bijv. 06 12345678" value="${esc(p.phone)}" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Gegevens opslaan</button>
        </div>
      </form>
    </div>
  `;
}

function renderAssets() {
  const adding = ui.addingAssetType;
  let formHtml = '';
  if (adding) {
    const cat = ASSET_CATEGORIES.find(c => c.key === adding.categoryKey);
    const type = findType(adding.categoryKey, adding.typeKey);
    const extraFieldsHtml = (type.extraFields || []).map(ef => `
          <div class="field">
            <label for="as-${ef.key}">${esc(ef.label)} <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="as-${ef.key}" name="${ef.key}" type="text" placeholder="${esc(ef.placeholder || '')}" value="${esc((ui.draftAsset[ef.key] || ''))}">
          </div>`).join('');
    formHtml = `
      <div class="inline-form-card">
        <div class="form-title"><span class="badge-pill">${esc(cat.label)}</span> ${iconSvg(type.icon, 16)} ${esc(type.label)}</div>
        <form id="asset-form">
          <div class="field">
            <label for="as-name">Naam</label>
            <input id="as-name" name="name" type="text" placeholder="${esc(type.namePlaceholder || 'bijv. naam van deze bezitting')}" value="${esc(ui.draftAsset.name || '')}" required autofocus>
          </div>
          ${extraFieldsHtml}
          <div class="field">
            <label for="as-description">Beschrijving <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="as-description" name="description" type="text" placeholder="Een korte notitie over deze bezitting" value="${esc(ui.draftAsset.description || '')}">
          </div>
          <div class="field">
            <label for="as-location">Locatie <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="as-location" name="location" type="text" placeholder="Waar het te vinden is" value="${esc(ui.draftAsset.location || '')}">
          </div>
          <div class="field">
            <label for="as-notes">Notities <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="as-notes" name="notes" type="text" placeholder="Iets anders dat het weten waard is" value="${esc(ui.draftAsset.notes || '')}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Bezitting opslaan</button>
            <button type="button" class="btn btn-ghost" data-action="cancel-asset">Annuleren</button>
          </div>
        </form>
      </div>
    `;
  }

  const typeGroups = ASSET_CATEGORIES.map(cat => `
    <div class="type-group">
      <h3>${esc(cat.label)}</h3>
      <div class="type-tiles">
        ${cat.types.map(t => `
          <button type="button" class="type-tile ${adding && adding.categoryKey === cat.key && adding.typeKey === t.key ? 'selected' : ''}"
            data-action="pick-asset-type" data-category="${cat.key}" data-type="${t.key}">
            <span class="tile-icon">${iconSvg(t.icon, 18)}</span>${esc(t.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  const hasAny = state.assets.length > 0;

  const listHtml = ASSET_CATEGORIES.map(cat => {
    const items = state.assets.filter(a => a.categoryKey === cat.key);
    if (!items.length) return '';
    return `
      <div class="type-group">
        <h3>${esc(cat.label)}</h3>
        <div class="item-list">
          ${items.map(a => `
            <div class="item-card">
              <div class="item-card-top">
                <span class="item-tag">${esc(a.typeLabel)}</span>
                <button class="btn-danger-ghost" data-action="delete-asset" data-id="${a.id}">Verwijderen</button>
              </div>
              <h4>${esc(a.name)}</h4>
              ${(findType(a.categoryKey, a.typeKey)?.extraFields || []).map(ef => (a.extra || {})[ef.key] ? `<p class="meta-row"><strong>${esc(ef.label)}:</strong> ${esc(a.extra[ef.key])}</p>` : '').join('')}
              ${a.description ? `<p class="meta-row">${esc(a.description)}</p>` : ''}
              ${a.location ? `<p class="meta-row"><strong>Locatie:</strong> ${esc(a.location)}</p>` : ''}
              ${a.notes ? `<p class="meta-row"><strong>Notities:</strong> ${esc(a.notes)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  if (hasAny) {
    // Assets exist: show list first, add-panel behind a toggle button
    const pickerHtml = ui.addingAsset ? `
      <div class="asset-picker-panel">
        ${typeGroups}
        ${formHtml}
        ${!adding ? `<div style="margin-top:8px;"><button type="button" class="btn btn-ghost btn-sm" data-action="cancel-asset">Sluiten</button></div>` : ''}
      </div>
    ` : '';
    return `
      ${pageHeader({ kicker: 'Bezittingen', title: 'Jouw bezittingen.', sub: 'Kies wat je wilt toevoegen. We vragen alleen waar je het kunt vinden, nooit hoe je erbij kunt komen.' })}
      <div class="trust-banner"><span class="lock">${iconSvg('lock', 17)}</span><div>Geen wachtwoorden. Geen inloggegevens. <strong>Een totaaloverzicht van je bezittingen voor wie je lief zijn.</strong></div></div>
      ${pickerHtml}
      ${listHtml}
      ${!ui.addingAsset ? `<div style="margin-top:24px;"><button type="button" class="btn btn-primary" data-action="open-asset-picker">${iconSvg('plus', 16)} Bezitting toevoegen</button></div>` : ''}
    `;
  } else {
    // No assets yet: show tile grid immediately to encourage first add
    return `
      ${pageHeader({ kicker: 'Bezittingen', title: 'Houd alles wat belangrijk is georganiseerd.', sub: 'Kies wat je wilt toevoegen. We vragen alleen waar je het kunt vinden, nooit hoe je erbij kunt komen.' })}
      <div class="trust-banner"><span class="lock">${iconSvg('lock', 17)}</span><div>Geen wachtwoorden. Geen inloggegevens. <strong>Een totaaloverzicht van je bezittingen voor wie je lief zijn.</strong></div></div>
      ${formHtml}
      ${typeGroups}
      <div class="empty-state">Nog geen bezittingen. Kies hierboven een type om je eerste toe te voegen, het duurt minder dan 30 seconden.</div>
    `;
  }
}

// Voorbeeld-e-mail aan een nieuw vertrouwd contact: getoond als modal direct na het
// opslaan van een contact (zie het contact-formulier in wireEvents), zodat duidelijk is
// wat zo'n contact te zien zou krijgen. Er wordt in deze demo geen echte e-mail verzonden.
function renderContactInviteModal() {
  const c = ui.contactInvitePreview;
  if (!c) return '';
  const accountFirst = getFirstName();
  const contactFirst = (c.name || '').trim().split(' ')[0] || c.name;
  const rolesParas = [];
  if ((c.roles || []).includes('verify')) {
    rolesParas.push(`Jij hebt de rol "Helpen bevestigen": als ${esc(accountFirst)} komt te overlijden, kun jij dit op elk moment melden via de link "Overlijden melden" op de AfterFile-website. Daar vul je ${esc(accountFirst)}s naam en e-mailadres in, samen met je eigen contactgegevens ter verificatie.`);
  }
  if ((c.roles || []).includes('inform')) {
    rolesParas.push(`Jij hebt de rol "Informatie ontvangen": zodra een overlijdensmelding is ingediend en door AfterFile geverifieerd, ontvang jij de gegevens die ${esc(accountFirst)} heeft vastgelegd, doorgaans binnen 1 werkdag.`);
  }
  return `
    <div class="invite-modal-overlay" data-action="close-invite-preview"></div>
    <div class="invite-modal" role="dialog" aria-modal="true" aria-label="Voorbeeld e-mail aan vertrouwd contact">
      <div class="invite-modal-top">
        <span>Contact opgeslagen — zo zou de e-mail eruitzien</span>
        <button type="button" class="invite-modal-close" data-action="close-invite-preview" aria-label="Sluiten">${iconSvg('x', 16)}</button>
      </div>
      <div class="invite-mock">
        <div class="invite-mock-meta">
          <p><strong>Van:</strong> AfterFile &lt;no-reply@afterfile.nl&gt;</p>
          <p><strong>Aan:</strong> ${esc(c.email)}</p>
          <p><strong>Onderwerp:</strong> Je bent toegevoegd als vertrouwd contact bij AfterFile</p>
        </div>
        <div class="invite-mock-body">
          <p>Hoi ${esc(contactFirst)},</p>
          <p>${esc(accountFirst)} heeft jou toegevoegd als vertrouwd contact bij AfterFile, een persoonlijke plek om belangrijke digitale zaken vast te leggen voor het moment dat dat nodig is.</p>
          ${rolesParas.map(p => `<p>${p}</p>`).join('')}
          <p>${esc(TRUST_LINE)}</p>
        </div>
        <div class="invite-mock-footnote">Dit is een voorbeeld in deze demo: er wordt geen echte e-mail verzonden.</div>
      </div>
      <div class="invite-modal-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="close-invite-preview">Sluiten</button>
      </div>
    </div>
  `;
}

function renderContacts() {
  const relationshipOptionsHtml = RELATIONSHIP_SUGGESTIONS.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');

  const formHtml = `
    <div class="inline-form-card">
      <div class="form-title">Vertrouwd contact toevoegen</div>
      <form id="contact-form">
        <div class="field-row">
          <div class="field">
            <label for="ct-name">Naam</label>
            <input id="ct-name" name="name" type="text" placeholder="bijv. Anna de Vries" value="${esc(ui.draftContact.name || '')}" required autofocus>
          </div>
          <div class="field">
            <label for="ct-email">E-mailadres</label>
            <input id="ct-email" name="email" type="email" placeholder="anna@voorbeeld.nl" value="${esc(ui.draftContact.email || '')}" required>
          </div>
        </div>
        <div class="field">
          <label for="ct-relationship">Relatie</label>
          <select id="ct-relationship" name="relationship">
            ${RELATIONSHIP_SUGGESTIONS.map(r => `<option value="${esc(r)}" ${ui.draftContact.relationship === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            <option value="">Anders…</option>
          </select>
          <input id="ct-relationship-other" name="relationship-other" type="text" placeholder="Vul je eigen relatie in" style="display:none; margin-top:10px;">
        </div>
        <div class="field">
          <label for="ct-address">Adres <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
          <input id="ct-address" name="address" type="text" placeholder="bijv. Hoofdstraat 12, 1234 AB Amsterdam">
        </div>
        <div class="field-row">
          <div class="field">
            <label for="ct-birthdate">Geboortedatum <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="ct-birthdate" name="birthDate" type="text" inputmode="numeric" placeholder="DD-MM-JJJJ" pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}" value="${esc(ui.draftContact.birthDate || '')}">
          </div>
          <div class="field">
            <label for="ct-phone">Telefoonnummer <span style="color:var(--color-text-faint); font-weight:400;">(optioneel)</span></label>
            <input id="ct-phone" name="phone" type="tel" placeholder="bijv. 06 12345678" value="${esc(ui.draftContact.phone || '')}">
          </div>
        </div>
        <div class="field">
          <label>Wat moet deze persoon kunnen doen?</label>
          <div class="role-options">
            <label class="role-option">
              <input type="checkbox" name="role-inform" ${ui.draftContact._touched ? (ui.draftContact.roleInform !== false ? 'checked' : '') : 'checked'}>
              <span>Jouw informatie ontvangen</span>
              <span class="role-option-check" style="margin-left:auto;">✓</span>
            </label>
            <label class="role-option">
              <input type="checkbox" name="role-verify" ${ui.draftContact.roleVerify ? 'checked' : ''}>
              <span>Helpen bevestigen wat er is gebeurd</span>
              <span class="role-option-check" style="margin-left:auto;">✓</span>
            </label>
          </div>
          <div class="field-hint">Een contact met de rol "Helpen bevestigen" kan via de "Overlijden melden"-link op de AfterFile-website een melding indienen met een officieel overlijdensbericht. AfterFile controleert dit en geeft de gegevens vrij aan contacten met de rol "Informatie ontvangen", doorgaans binnen 1 werkdag.</div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Contact opslaan</button>
          <button type="button" class="btn btn-ghost" data-action="cancel-contact">Annuleren</button>
        </div>
      </form>
    </div>
  `;

  const listHtml = state.contacts.map(c => `
    <div class="item-card">
      <div class="item-card-top">
        <span class="item-tag">${esc(c.relationship || 'Contact')}</span>
        <button class="btn-danger-ghost" data-action="delete-contact" data-id="${c.id}">Verwijderen</button>
      </div>
      <h4>${esc(c.name)}</h4>
      <p class="meta-row">${esc(c.email)}</p>
      ${c.phone ? `<p class="meta-row"><strong>Telefoon:</strong> ${esc(c.phone)}</p>` : ''}
      ${c.address ? `<p class="meta-row"><strong>Adres:</strong> ${esc(c.address)}</p>` : ''}
      ${c.birthDate ? `<p class="meta-row"><strong>Geboortedatum:</strong> ${esc(toNlDate(c.birthDate))}</p>` : ''}
      <div>
        ${c.roles.includes('inform') ? '<span class="role-chip">Ontvangt informatie</span>' : ''}
        ${c.roles.includes('verify') ? '<span class="role-chip">Kan helpen verifiëren</span>' : ''}
      </div>
    </div>
  `).join('');

  const hasAny = state.contacts.length > 0;

  if (hasAny) {
    return `
      ${pageHeader({ kicker: 'Vertrouwde contacten', title: 'Jouw contacten.', sub: 'Voeg de mensen toe die het zouden willen weten, een partner, kind, executeur of vriend(in).' })}
      ${ui.addingContact ? `<div class="asset-picker-panel">${formHtml}</div>` : ''}
      <div class="item-list">${listHtml}</div>
      ${!ui.addingContact ? `<div style="margin-top:24px;"><button type="button" class="btn btn-primary" data-action="open-contact-form">${iconSvg('plus', 16)} Contact toevoegen</button></div>` : ''}
    `;
  } else {
    return `
      ${pageHeader({ kicker: 'Vertrouwde contacten', title: 'Kies wie geïnformeerd moet worden.', sub: 'Voeg de mensen toe die het zouden willen weten, een partner, kind, executeur of vriend(in).' })}
      ${formHtml}
      <div class="empty-state">Nog geen vertrouwde contacten. Vul hierboven de eerste persoon in, het duurt minder dan 30 seconden.</div>
    `;
  }
}


function renderInstructions() {
  return `
    ${pageHeader({ kicker: 'Instructies', title: 'Help je dierbaren vinden wat belangrijk is.', sub: 'Wat zou je je dierbaren willen laten weten?' })}
    <div class="editor-card">
      <textarea id="instructions-text" placeholder="Bijv. Mijn Ledger-apparaat ligt in de zwarte kluis op kantoor.">${esc(state.instructions)}</textarea>
      <div class="save-indicator" id="save-indicator">${state.instructions ? 'Opgeslagen' : ''}</div>
    </div>
    <div class="instruction-tip">
      ${iconSvg('key', 15)}
      <span><strong>Vergeet je wachtwoordmanager niet.</strong> Vermeld welke app je gebruikt (bijv. 1Password of Bitwarden) en waar je masterkey of emergency kit te vinden is — bij de notaris, in een kluis of in een envelop. AfterFile bewaart zelf nooit wachtwoorden.</span>
    </div>

  `;
}


// ── Kluis render ──────────────────────────────────────────────────────────
const VK_PADLOCK = `<svg class="vk-padlock-svg" viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg"><path class="vk-shackle" d="M14 32 V20 A18 18 0 0 1 50 20 V32" stroke="url(#vkg)" stroke-width="7" stroke-linecap="round" fill="none"/><rect x="4" y="29" width="56" height="40" rx="10" fill="url(#vkb)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/><circle cx="32" cy="50" r="7" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/><rect x="29.5" y="54" width="5" height="8" rx="2.5" fill="rgba(255,255,255,0.65)"/><defs><linearGradient id="vkg" x1="14" y1="20" x2="50" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#a78bfa"/></linearGradient><linearGradient id="vkb" x1="4" y1="29" x2="60" y2="69" gradientUnits="userSpaceOnUse"><stop stop-color="#1e3a5f"/><stop offset="1" stop-color="#0c1a36"/></linearGradient></defs></svg>`;

function renderVault() {
  if (!state.account) return '';
  if (ui.vaultState === 'setup')    return renderVaultSetup();
  if (ui.vaultState === 'locked')   return renderVaultLock();
  return renderVaultUnlocked();
}

function renderVaultLock() {
  return `
    <div class="vk-screen">
      <div class="vk-card">
        <div class="vk-icon-wrap">${VK_PADLOCK}</div>
        <h1 class="vk-title">Kluis</h1>
        <p class="vk-sub">Voer je mastercode in om verder te gaan</p>
        <input class="vk-input" id="vk-pw" type="password" placeholder="Mastercode" autocomplete="current-password">
        <button class="vk-btn" id="vk-unlock-btn">Ontgrendelen</button>
        <p class="vk-err" id="vk-err" style="display:none">Onjuiste code, probeer opnieuw.</p>
      </div>
    </div>
  `;
}

function renderVaultSetup() {
  return `
    <div class="vk-screen">
      <div class="vk-card">
        <div class="vk-icon-wrap">${VK_PADLOCK}</div>
        <h1 class="vk-title">Kluis instellen</h1>
        <p class="vk-sub">Kies een sterke mastercode. Schrijf hem op papier, sla hem nergens digitaal op.</p>
        <input class="vk-input" id="vk-setup-pw"  type="password" placeholder="Mastercode (min. 8 tekens)" autocomplete="new-password">
        <input class="vk-input" id="vk-setup-pw2" type="password" placeholder="Herhaal mastercode"         autocomplete="new-password">
        <button class="vk-btn" id="vk-setup-btn">Kluis aanmaken</button>
        <p class="vk-err" id="vk-err" style="display:none"></p>
        <p class="vk-notice">${iconSvg('alert-triangle', 13)} Als je je mastercode vergeet zijn je gegevens permanent ontoegankelijk. Er is geen hersteloptie.</p>
      </div>
    </div>
  `;
}

function renderVaultUnlocked() {
  const entries = (ui.vaultData && ui.vaultData.entries) || [];
  const total   = state.assets.length;
  const secured = entries.length;
  const rows = ASSET_CATEGORIES.map(cat => {
    const items = state.assets.filter(a => a.categoryKey === cat.key);
    if (!items.length) return '';
    return `<div class="vk-section">
      <p class="vk-section-label">${esc(cat.label)}</p>
      ${items.map(a => {
        const type  = (cat.types || []).find(t => t.key === a.typeKey);
        const icon  = type ? type.icon : 'folder';
        const entry = entries.find(e => e.assetId === a.id);
        return `<div class="vk-row${entry ? ' vk-row--on' : ''}">
          <div class="vk-row-icon">${iconSvg(icon, 18)}</div>
          <div class="vk-row-info">
            <div class="vk-row-name">${esc(a.name)}</div>
            <div class="vk-row-type">${esc(a.typeLabel)}</div>
          </div>
          ${entry ? `
            <div class="vk-creds">
              <div class="vk-cred">
                <span class="vk-cred-lbl">Gebruiker</span>
                <span class="vk-cred-val">${esc(entry.username || '-')}</span>
                ${entry.username ? `<button class="vk-copy" data-copy="${esc(entry.username)}">${iconSvg('copy', 13)}</button>` : ''}
              </div>
              <div class="vk-cred">
                <span class="vk-cred-lbl">Wachtwoord</span>
                <span class="vk-cred-val vk-dots" id="vkpw-${entry.id}">........</span>
                <button class="vk-eye" data-pw="${esc(entry.password)}" data-id="${entry.id}">${iconSvg('eye', 13)}</button>
                <button class="vk-copy" data-copy="${esc(entry.password)}">${iconSvg('copy', 13)}</button>
              </div>
              ${entry.notes ? `<div class="vk-cred"><span class="vk-cred-lbl">Notitie</span><span class="vk-cred-val">${esc(entry.notes)}</span></div>` : ''}
            </div>
            <button class="vk-edit" data-action="vault-edit" data-asset-id="${a.id}">${iconSvg('edit', 13)} Bewerk</button>
          ` : `<button class="vk-add" data-action="vault-add" data-asset-id="${a.id}">+ Toevoegen</button>`}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  return `
    <div class="vk-wrap">
      <div class="vk-topbar">
        <div>
          <h1 class="vk-topbar-title">Kluis</h1>
          <p class="vk-topbar-sub">${secured} van ${total} bezittingen beveiligd</p>
        </div>
        <button class="vk-lock-btn" data-action="vault-lock">${iconSvg('lock', 15)} Vergrendelen</button>
      </div>
      <div class="vk-list">
        ${total > 0 ? rows : '<div class="vk-empty"><p>Voeg eerst bezittingen toe via <a href="#" data-nav="assets">Bezittingen</a>.</p></div>'}
      </div>
      ${ui.vaultModal ? renderVaultModal() : ''}
    </div>
  `;
}

function renderVaultModal() {
  const m = ui.vaultModal;
  const asset = state.assets.find(a => a.id === m.assetId);
  if (!asset) return '';
  return `
    <div class="vk-modal-bd" id="vk-modal-bd">
      <div class="vk-modal">
        <div class="vk-modal-head">
          <div class="vk-modal-title">${m.id ? 'Inloggegevens bewerken' : 'Inloggegevens opslaan'}</div>
          <div class="vk-modal-asset">${esc(asset.name)}</div>
        </div>
        <div class="field">
          <label>Gebruikersnaam / e-mail <span class="vk-opt">(optioneel)</span></label>
          <input id="vk-m-user" type="text" placeholder="jan@gmail.com" value="${esc(m.username || '')}" autocomplete="off">
        </div>
        <div class="field">
          <label>Wachtwoord <span class="vk-opt">(optioneel)</span></label>
          <div class="pw-input-wrap">
            <input id="vk-m-pw" type="password" placeholder="........" value="${esc(m.password || '')}" autocomplete="new-password">
            <button type="button" class="pw-text-btn" id="vk-m-pw-toggle">Toon</button>
          </div>
        </div>
        <div class="field">
          <label>Notitie <span class="vk-opt">(optioneel)</span></label>
          <input id="vk-m-notes" type="text" placeholder="bijv. antwoord beveiligingsvraag" value="${esc(m.notes || '')}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" id="vk-m-save"${m.saving ? ' disabled' : ''}>${m.saving ? 'Bezig...' : 'Opslaan'}</button>
          ${m.id ? '<button class="btn btn-ghost" id="vk-m-del">Verwijderen</button>' : ''}
          <button class="btn btn-ghost" data-action="vault-modal-close">Annuleren</button>
        </div>
      </div>
    </div>
  `;
}

function renderReport() {
  const isCompleet = state.account && state.account.plan !== 'basis';
  const pct = computeCompletion();
  return `
    ${pageHeader({ kicker: 'Legacy Report', title: 'Alles op één plek, klaar om te delen.', sub: 'Een duidelijke, afdrukbare samenvatting voor de mensen die het nodig hebben, je familie, een executeur of een notaris.' })}
    <div class="report-actions">
      ${isCompleet ? `
        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-primary" data-action="download-report-pdf">
            ${iconSvg('file-text', 14)} Download als PDF
          </button>
        </div>
      ` : `
        <div class="report-gate">
          <p><strong>PDF download is beschikbaar in het Compleet abonnement.</strong></p>
          <p>Upgrade om jouw Legacy Report als PDF te downloaden en te bewaren of te delen.</p>
          <button type="button" class="btn btn-primary" data-action="nav" data-page="plan">Bekijk abonnementen</button>
        </div>
      `}
    </div>
    <div class="report-preview">
      <h2>Digitale &amp; financiële bezittingen</h2>
      ${state.assets.length ? state.assets.map(a => `
        <div class="report-row"><div class="name">${esc(a.name)}<span style="color:var(--color-text-faint); font-weight:400;">, ${esc(a.typeLabel)}</span></div>
        ${a.location ? `<div class="sub">Locatie: ${esc(a.location)}</div>` : ''}</div>
      `).join('') : `<div class="report-row sub">Nog geen bezittingen toegevoegd.</div>`}

      <h2>Vertrouwde contacten</h2>
      ${state.contacts.length ? state.contacts.map(c => `
        <div class="report-row"><div class="name">${esc(c.name)}<span style="color:var(--color-text-faint); font-weight:400;">, ${esc(c.relationship || 'Contact')}</span></div>
        <div class="sub">${esc(c.email)} · ${esc(rolesLabel(c.roles))}</div></div>
      `).join('') : `<div class="report-row sub">Nog geen vertrouwde contacten toegevoegd.</div>`}

      <h2>Instructies</h2>
      <div class="instructions-text">${state.instructions.trim() ? esc(state.instructions) : 'Nog geen instructies geschreven.'}</div>

      <h2>Wanneer wordt dit gedeeld?</h2>
      <div class="instructions-text">Een contact met de rol "Helpen bevestigen" kan via de "Overlijden melden"-link op de AfterFile-website een melding indienen. AfterFile controleert dit en geeft de gegevens vrij aan contacten met de rol "Informatie ontvangen", doorgaans binnen 1 werkdag.</div>
    </div>
  `;
}

function downloadReportPDF() {
  const p = state.personalInfo || {};
  const name = p.fullName || 'Onbekend';
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  const assetsRows = state.assets.length
    ? state.assets.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.typeLabel)}</td><td>${esc(a.location || '')}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#888;">Geen bezittingen toegevoegd.</td></tr>';

  const contactRows = state.contacts.length
    ? state.contacts.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(rolesLabel(c.roles))}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#888;">Geen contacten toegevoegd.</td></tr>';

  const instructies = state.instructions.trim() ? esc(state.instructions).replace(/\n/g, '<br>') : '<span style="color:#888;">Geen instructies geschreven.</span>';

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Legacy Report – ${esc(name)}</title>
<style>
  body { font-family: Georgia, serif; font-size: 13px; color: #111; margin: 0; padding: 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 32px; }
  h2 { font-size: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { text-align: left; font-size: 11px; color: #666; padding: 4px 8px; border-bottom: 1px solid #eee; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .instructions { white-space: pre-wrap; line-height: 1.6; margin-top: 10px; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <h1>Legacy Report</h1>
  <div class="sub">Opgesteld voor ${esc(name)} &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; AfterFile</div>

  <h2>Persoonlijke gegevens</h2>
  <table>
    <tr><th>Naam</th><th>Adres</th><th>Geboortedatum</th></tr>
    <tr>
      <td>${esc(p.fullName || '')}</td>
      <td>${esc([p.street, p.postalCode, p.city].filter(Boolean).join(', ') || '')}</td>
      <td>${esc(toNlDate(p.birthDate) || '')}</td>
    </tr>
  </table>

  <h2>Digitale &amp; financiële bezittingen</h2>
  <table>
    <tr><th>Naam</th><th>Type</th><th>Locatie / login</th></tr>
    ${assetsRows}
  </table>

  <h2>Vertrouwde contacten</h2>
  <table>
    <tr><th>Naam</th><th>E-mail</th><th>Rol</th></tr>
    ${contactRows}
  </table>

  <h2>Instructies &amp; wensen</h2>
  <div class="instructions">${instructies}</div>

  <div class="footer">Dit document is gegenereerd via AfterFile (afterfile.nl). Bewaar het op een veilige plek.</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { flashToast('Pop-up geblokkeerd. Sta pop-ups toe voor deze pagina.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}


function renderAdmin() {
  const signups = (state.signups || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const planLabel = (key) => { const p = PLANS.find(pl => pl.key === key); return p ? p.name : key; };

  const rowsHtml = signups.length ? signups.map(s => {
    const open = ui.openSignupId === s.id;
    const p = s.personalInfo || {};
    const infoFilled = ['fullName', 'street', 'postalCode', 'city', 'birthDate', 'phone'].every(k => (p[k] || '').trim().length > 0);
    const assets = s.assets || [];
    const contacts = s.contacts || [];
    const instr = (s.instructions || '').trim();
    const ci = s.checkins || { status: 'active' };
    const ciLabel = { active: 'Actief, niets gemeld', waiting: 'Wachttijd loopt', shared: 'Informatie gedeeld' }[ci.status] || 'Actief, niets gemeld';
    return `
      <div class="admin-row ${open ? 'open' : ''}">
        <button type="button" class="admin-row-summary" data-action="toggle-signup" data-id="${s.id}">
          <div class="admin-row-main">
            <strong>${esc(s.name)}</strong>
            <span class="admin-row-email">${esc(s.email)}</span>
          </div>
          <span class="admin-pill admin-pill--${s.plan}">${esc(planLabel(s.plan))}</span>
          <span class="admin-row-date">${esc(formatDate(new Date(s.createdAt)))}</span>
          ${iconSvg('chevron-down', 18)}
        </button>
        <div class="admin-row-detail">
          <div class="admin-detail-grid">
            <div class="admin-detail-block">
              <h4>${iconSvg('info', 14)} Persoonsgegevens</h4>
              ${infoFilled ? `
                <p class="meta-row">${esc(p.fullName)}</p>
                <p class="meta-row">${esc(p.street)}, ${esc(p.postalCode)} ${esc(p.city)}</p>
                <p class="meta-row"><strong>Geboortedatum:</strong> ${esc(toNlDate(p.birthDate))}</p>
                <p class="meta-row"><strong>Telefoon:</strong> ${esc(p.phone)}</p>
              ` : `<p class="meta-row faint">Nog niet ingevuld.</p>`}
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('folder', 14)} Bezittingen (${assets.length})</h4>
              ${assets.length ? assets.map(a => `<p class="meta-row"><strong>${esc(a.name)}</strong>, ${esc(a.typeLabel)}${a.location ? ` · ${esc(a.location)}` : ''}</p>`).join('') : `<p class="meta-row faint">Nog geen bezittingen.</p>`}
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('users', 14)} Contacten (${contacts.length})</h4>
              ${contacts.length ? contacts.map(c => `<p class="meta-row"><strong>${esc(c.name)}</strong>, ${esc(c.relationship || 'Contact')} · ${esc(c.email)} · ${esc(rolesLabel(c.roles))}</p>`).join('') : `<p class="meta-row faint">Nog geen contacten.</p>`}
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('file-text', 14)} Instructies</h4>
              <p class="meta-row${instr ? '' : ' faint'}">${instr ? esc(instr) : 'Nog niet geschreven.'}</p>
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('info', 14)} Status meldproces</h4>
              <p class="meta-row">${esc(ciLabel)}</p>
              ${ci.reportedBy ? `
                <p class="meta-row"><strong>Gemeld door:</strong> ${esc(ci.reportedBy.name)} (${esc(ci.reportedBy.email)})${ci.reportedBy.phone ? ` · ${esc(ci.reportedBy.phone)}` : ''}${ci.reportedBy.relationship ? ` · ${esc(ci.reportedBy.relationship)}` : ''}</p>
                ${ci.reportedBy.message ? `<p class="meta-row faint">${esc(ci.reportedBy.message)}</p>` : ''}
                ${ci.reportedBy.certificatePath ? `
                  <p class="meta-row"><strong>Akte van overlijden:</strong> <a href="#" data-action="view-certificate" data-path="${esc(ci.reportedBy.certificatePath)}" style="color:var(--color-primary);">Document bekijken</a></p>
                ` : `<p class="meta-row faint">Geen akte geüpload.</p>`}
                ${ci.status === 'waiting' ? `
                  <div style="margin-top:10px;">
                    <button type="button" class="btn btn-primary btn-sm" data-action="approve-death-report" data-id="${s.id}">
                      Informatie vrijgeven
                    </button>
                  </div>
                ` : ''}
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div class="empty-state">Nog geen aanmeldingen.</div>`;

  const waitlist = (state.waitlist || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Partner/referral breakdown
  const partnerCounts = {};
  const referralLabels = { notaris: 'Via een notaris', advocaat: 'Via een advocaat', social: 'Via social media', vriend: 'Via vriend/familie', anders: 'Anders' };
  waitlist.forEach(w => {
    const key = w.partner || (w.referral_source ? referralLabels[w.referral_source] || w.referral_source : null);
    if (key) partnerCounts[key] = (partnerCounts[key] || 0) + 1;
  });
  const partnerRows = Object.entries(partnerCounts).sort((a, b) => b[1] - a[1]);
  const partnerTableHtml = partnerRows.length ? `
    <div class="partner-stats">
      <h4 style="margin:0 0 10px;">Verwijzingen</h4>
      <table class="partner-stats-table">
        <thead><tr><th>Partner / kanaal</th><th>Aanmeldingen</th></tr></thead>
        <tbody>
          ${partnerRows.map(([key, count]) => `<tr><td>${esc(key)}</td><td><strong>${count}</strong></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const waitlistHtml = waitlist.length ? `
    <div class="admin-list">
      ${waitlist.map(w => {
        const ref = w.partner || (w.referral_source ? (referralLabels[w.referral_source] || w.referral_source) + (w.referral_other ? ': ' + w.referral_other : '') : null);
        return `
        <div class="admin-row">
          <div class="admin-row-summary" style="cursor:default;">
            <div class="admin-row-main">
              <strong>${esc(w.name)}</strong>
              <span class="admin-row-email">${esc(w.email)}</span>
              ${ref ? `<span class="admin-row-ref">${esc(ref)}</span>` : ''}
            </div>
            <span class="admin-row-date">${esc(formatDate(new Date(w.createdAt)))}</span>
          </div>
        </div>
      `}).join('')}
    </div>
  ` : `<div class="empty-state">Nog niemand op de wachtlijst.</div>`;

  // Contacts overview: all contacts across all signups
  const allContacts = signups.flatMap(s =>
    (s.contacts || []).map(c => ({ ...c, accountName: s.name, accountEmail: s.email }))
  );
  const contactEmails = [...new Set(allContacts.map(c => (c.email || '').trim()).filter(Boolean))];
  const contactsOverviewHtml = allContacts.length ? `
    <div class="admin-contacts-table-wrap">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
        <h4 style="margin:0;">Alle contacten (${allContacts.length})</h4>
        <button type="button" class="btn btn-sm" data-action="copy-contact-emails">Kopieer alle e-mailadressen (${contactEmails.length})</button>
      </div>
      <table class="admin-contacts-table">
        <thead><tr><th>Naam contact</th><th>E-mail</th><th>Rol</th><th>Account van</th></tr></thead>
        <tbody>
          ${allContacts.map(c => `<tr>
            <td>${esc(c.name || '')}</td>
            <td>${esc(c.email || '')}</td>
            <td>${esc(rolesLabel(c.roles))}</td>
            <td>${esc(c.accountName || c.accountEmail || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  return `
    ${pageHeader({ kicker: 'Beheer', title: 'Aanmeldingen inzien.', sub: 'Een overzicht van iedereen die zich in deze browser heeft aangemeld, met hun ingevulde gegevens.' })}

    ${PRELAUNCH_MODE ? `
      <h3 style="margin-top:32px;">Wachtlijst (${waitlist.length})</h3>
      ${partnerTableHtml}
      ${waitlistHtml}
      <div class="section-divider"></div>
    ` : ''}
    <div class="admin-list">${rowsHtml}</div>
    ${contactsOverviewHtml ? `<div class="section-divider"></div>${contactsOverviewHtml}` : ''}
  `;
}

// ---------- events ----------
function wireEvents() {
  // ── Vault ─────────────────────────────────────────────────────────────
  async function doVkUnlock() {
    const inp = document.getElementById('vk-pw');
    const btn = document.getElementById('vk-unlock-btn');
    if (!inp || !btn) return;
    const pw = (inp.value || '').trim();
    if (!pw) return;
    btn.disabled = true; btn.textContent = 'Even geduld...';
    const ok = await vkUnlock(pw);
    if (ok) { render(); return; }
    btn.disabled = false; btn.textContent = 'Ontgrendelen';
    const err = document.getElementById('vk-err');
    if (err) err.style.display = 'block';
    inp.classList.add('vk-shake');
    setTimeout(() => inp.classList.remove('vk-shake'), 600);
  }
  const vkUnlockBtn = document.getElementById('vk-unlock-btn');
  if (vkUnlockBtn) {
    vkUnlockBtn.addEventListener('click', doVkUnlock);
    const vkPwInp = document.getElementById('vk-pw');
    if (vkPwInp) { vkPwInp.addEventListener('keydown', e => { if (e.key === 'Enter') doVkUnlock(); }); setTimeout(() => vkPwInp.focus(), 60); }
  }
  const vkSetupBtn = document.getElementById('vk-setup-btn');
  if (vkSetupBtn) {
    vkSetupBtn.addEventListener('click', async () => {
      const pw  = (document.getElementById('vk-setup-pw').value || '').trim();
      const pw2 = (document.getElementById('vk-setup-pw2').value || '').trim();
      const err = document.getElementById('vk-err');
      if (!pw || pw.length < 8) { err.textContent = 'Kies een mastercode van minimaal 8 tekens.'; err.style.display = 'block'; return; }
      if (pw !== pw2)           { err.textContent = 'Codes komen niet overeen.';                  err.style.display = 'block'; return; }
      vkSetupBtn.disabled = true; vkSetupBtn.textContent = 'Even geduld...';
      await vkSetup(pw); render();
    });
    setTimeout(() => { const i = document.getElementById('vk-setup-pw'); if (i) i.focus(); }, 60);
  }
  document.querySelectorAll('[data-action="vault-lock"]').forEach(b => b.addEventListener('click', vkLock));
  document.querySelectorAll('[data-action="vault-add"]').forEach(b => {
    b.addEventListener('click', () => { vkResetTimer(); ui.vaultModal = { assetId: b.dataset.assetId, id: null, username: '', password: '', notes: '' }; render(); });
  });
  document.querySelectorAll('[data-action="vault-edit"]').forEach(b => {
    b.addEventListener('click', () => {
      vkResetTimer();
      const entry = (ui.vaultData && ui.vaultData.entries || []).find(e => e.assetId === b.dataset.assetId);
      if (!entry) return;
      ui.vaultModal = { assetId: b.dataset.assetId, id: entry.id, username: entry.username, password: entry.password, notes: entry.notes };
      render();
    });
  });
  document.querySelectorAll('[data-action="vault-modal-close"]').forEach(b => { b.addEventListener('click', () => { ui.vaultModal = null; render(); }); });
  const vkBd = document.getElementById('vk-modal-bd');
  if (vkBd) vkBd.addEventListener('click', e => { if (e.target === vkBd) { ui.vaultModal = null; render(); } });
  const vkMPwToggle = document.getElementById('vk-m-pw-toggle');
  if (vkMPwToggle) {
    vkMPwToggle.addEventListener('click', () => {
      const inp = document.getElementById('vk-m-pw'); if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      vkMPwToggle.textContent = inp.type === 'password' ? 'Toon' : 'Verberg';
    });
  }
  const vkMSave = document.getElementById('vk-m-save');
  if (vkMSave) {
    vkMSave.addEventListener('click', async () => {
      vkResetTimer();
      const m = ui.vaultModal; if (!m) return;
      const username = (document.getElementById('vk-m-user').value  || '').trim();
      const password = (document.getElementById('vk-m-pw').value    || '').trim();
      const notes    = (document.getElementById('vk-m-notes').value || '').trim();
      ui.vaultModal = { ...m, saving: true }; render();
      const entries = ui.vaultData.entries;
      if (m.id) {
        const idx = entries.findIndex(e => e.id === m.id);
        if (idx >= 0) entries[idx] = { ...entries[idx], username, password, notes };
      } else {
        entries.push({ id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)), assetId: m.assetId, username, password, notes });
      }
      await vkSave();
      ui.vaultModal = null; render();
      flashToast(m.id ? 'Bijgewerkt in kluis' : 'Opgeslagen in kluis');
    });
  }
  const vkMDel = document.getElementById('vk-m-del');
  if (vkMDel) {
    vkMDel.addEventListener('click', async () => {
      vkResetTimer();
      const m = ui.vaultModal; if (!m || !m.id) return;
      ui.vaultData.entries = ui.vaultData.entries.filter(e => e.id !== m.id);
      await vkSave(); ui.vaultModal = null; render();
      flashToast('Verwijderd uit kluis');
    });
  }
  document.querySelectorAll('[data-copy]').forEach(b => {
    b.addEventListener('click', () => { vkResetTimer(); navigator.clipboard.writeText(b.dataset.copy).then(() => flashToast('Gekopieerd')).catch(() => {}); });
  });
  document.querySelectorAll('.vk-eye').forEach(b => {
    b.addEventListener('click', () => {
      vkResetTimer();
      const el = document.getElementById('vkpw-' + b.dataset.id); if (!el) return;
      if (el.classList.contains('vk-dots')) { el.textContent = b.dataset.pw; el.classList.remove('vk-dots'); }
      else { el.textContent = '........'; el.classList.add('vk-dots'); }
    });
  });

  // --- Onboarding wizard ---
  if (ui.onboardingStep > 0) {
    const obForm1 = document.getElementById('ob-form-1');
    if (obForm1) {
      obForm1.addEventListener('submit', async e => {
        e.preventDefault();
        const fullName = (document.getElementById('ob-fullname').value || '').trim();
        if (!fullName) return;
        state.personalInfo = Object.assign({}, state.personalInfo, { fullName });
        if (supabase && state.account) {
          await supabase.from('profiles').update({ full_name: fullName }).eq('id', state.account.id);
        }
        ui.onboardingStep = 2;
        render();
      });
    }
    document.querySelectorAll('[data-action="ob-next"]').forEach(btn => btn.addEventListener('click', () => {
      ui.onboardingStep = Math.min(ui.onboardingStep + 1, 4);
      render();
    }));
    document.querySelectorAll('[data-action="ob-skip"]').forEach(btn => btn.addEventListener('click', () => finishOnboarding()));
    document.querySelectorAll('[data-action="ob-finish"]').forEach(btn => btn.addEventListener('click', () => finishOnboarding()));
    document.querySelectorAll('[data-action="ob-goto-assets"]').forEach(btn => btn.addEventListener('click', () => {
      finishOnboarding();
      state.view = personalInfoComplete() ? 'assets' : 'gegevens';
      saveState();
      render();
    }));
    document.querySelectorAll('[data-action="ob-goto-contacts"]').forEach(btn => btn.addEventListener('click', () => {
      finishOnboarding();
      state.view = 'contacts';
      saveState();
      render();
    }));
    return;
  }
  // --- Normale events ---
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      ui.accountMenuOpen = false;
      let target = el.getAttribute('data-nav');
      const planHint = el.getAttribute('data-plan');
      if (target === 'signup') {
        ui.selectedPlanKey = planHint || ui.selectedPlanKey || 'compleet';
        ui.signupEmailError = null;
        ui.betalingOpen = false;
        if (PRELAUNCH_MODE) target = 'waitlist';
      }
      navigate(target);
    });
  });

  const logoutBtn = document.querySelector('[data-action="logout"]');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    ui.accountMenuOpen = false;
    window.scrollTo(0, 0);
    // De rest (state resetten, terug naar landing, opnieuw renderen) gebeurt via
    // applySession(), die supabase.auth.onAuthStateChange() na signOut() aanroept.
    await supabase.auth.signOut();
  });

  const accountMenuTrigger = document.querySelector('[data-action="toggle-account-menu"]');
  if (accountMenuTrigger) accountMenuTrigger.addEventListener('click', () => {
    ui.accountMenuOpen = !ui.accountMenuOpen;
    render();
  });

  const accountMenuOverlay = document.querySelector('.account-menu-overlay');
  if (accountMenuOverlay) accountMenuOverlay.addEventListener('click', () => {
    ui.accountMenuOpen = false;
    render();
  });

  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    const email = (fd.get('email') || '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      ui.signupEmailError = 'Vul een geldig e-mailadres in.';
      render();
      const el = document.getElementById('su-email');
      if (el) el.focus();
      return;
    }
    const name = (fd.get('name') || '').trim() || email.split('@')[0];
    const planKey = ui.selectedPlanKey || 'compleet';
    ui.signupEmailError = null;
    ui.signupSubmitting = true;
    render();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // selected_plan reizen mee in de Supabase Auth user_metadata, zodat we na de
      // magic-link-redirect (zie maybeStartCheckout()) weten of er nog een Stripe Checkout
      // gestart moet worden voor een betaald plan.
      options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { name, selected_plan: planKey } },
    });
    ui.signupSubmitting = false;
    if (error) {
      ui.signupEmailError = 'Er ging iets mis bij het versturen van de inloglink. Probeer het opnieuw.';
      render();
      return;
    }
    ui.magicLinkSentTo = email;
    render();
  });

  document.querySelectorAll('[data-action="upgrade-plan"]').forEach(btn => {
    btn.addEventListener('click', () => startCheckout(btn.getAttribute('data-plan')));
  });

  document.querySelectorAll('[data-action="change-plan"]').forEach(btn => {
    btn.addEventListener('click', () => changeSubscriptionPlan(btn.getAttribute('data-plan')));
  });

  const betalingToggle = document.querySelector('[data-action="toggle-betaling"]');
  if (betalingToggle) betalingToggle.addEventListener('click', () => {
    ui.betalingOpen = !ui.betalingOpen;
    render();
  });

  const planSelect = document.getElementById('select-plan');
  if (planSelect) planSelect.addEventListener('change', () => {
    ui.selectedPlanKey = planSelect.value;
    render();
  });

  document.querySelectorAll('[name="billing-period"]').forEach(radio => {
    radio.addEventListener('change', () => {
      ui.billingPeriod = radio.value;
      render();
    });
  });

  document.querySelectorAll('[data-action="pick-asset-type"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const categoryKey = btn.getAttribute('data-category');
      const typeKey = btn.getAttribute('data-type');
      if (ui.addingAssetType && ui.addingAssetType.categoryKey === categoryKey && ui.addingAssetType.typeKey === typeKey) {
        ui.addingAssetType = null;
      } else {
        ui.addingAssetType = { categoryKey, typeKey };
      }
      render();
      setTimeout(() => { const el = document.getElementById('as-name'); if (el) el.focus(); }, 0);
    });
  });

  const cancelAssetBtn = document.querySelector('[data-action="cancel-asset"]');
  if (cancelAssetBtn) cancelAssetBtn.addEventListener('click', () => { ui.addingAssetType = null; ui.addingAsset = false; ui.draftAsset = {}; render(); });

  const openAssetPickerBtn = document.querySelector('[data-action="open-asset-picker"]');
  if (openAssetPickerBtn) openAssetPickerBtn.addEventListener('click', () => { ui.addingAsset = true; render(); });

  const cancelContactBtn = document.querySelector('[data-action="cancel-contact"]');
  if (cancelContactBtn) cancelContactBtn.addEventListener('click', () => { ui.addingContact = false; ui.draftContact = {}; render(); });

  const openContactFormBtn = document.querySelector('[data-action="open-contact-form"]');
  if (openContactFormBtn) openContactFormBtn.addEventListener('click', () => { ui.addingContact = true; render(); });

  const assetForm = document.getElementById('asset-form');
  if (assetForm) {
    assetForm.addEventListener('input', () => {
      const fd = new FormData(assetForm);
      ui.draftAsset = Object.fromEntries(fd.entries());
    });
    assetForm.addEventListener('change', () => {
      const fd = new FormData(assetForm);
      ui.draftAsset = Object.fromEntries(fd.entries());
    });
    assetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(assetForm);
    const { categoryKey, typeKey } = ui.addingAssetType;
    const type = findType(categoryKey, typeKey);
    const extra = {};
    (type.extraFields || []).forEach(ef => {
      const val = (fd.get(ef.key) || '').trim();
      if (val) extra[ef.key] = val;
    });
    const { data, error } = await supabase.from('assets').insert({
      account_id: state.account.id,
      category_key: categoryKey, type_key: typeKey, type_label: type.label,
      name: (fd.get('name') || '').trim(),
      extra,
      description: (fd.get('description') || '').trim(),
      location: (fd.get('location') || '').trim(),
      notes: (fd.get('notes') || '').trim(),
    }).select().single();
    if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
    state.assets.push(rowToAsset(data));
    ui.addingAssetType = null;
    ui.addingAsset = false;
    ui.draftAsset = {};
    syncCurrentSignupRecord();
    saveLocalDemoState();
    render();
    flashToast('Bezitting opgeslagen');
  });
  } // end if (assetForm)

  document.querySelectorAll('[data-action="delete-asset"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) { flashToast('Verwijderen is niet gelukt, probeer het opnieuw.'); return; }
      state.assets = state.assets.filter(a => a.id !== id);
      syncCurrentSignupRecord();
      saveLocalDemoState();
      render();
    });
  });

  const relationshipSelect = document.getElementById('ct-relationship');
  if (relationshipSelect) relationshipSelect.addEventListener('change', () => {
    const otherInput = document.getElementById('ct-relationship-other');
    if (!otherInput) return;
    if (relationshipSelect.value === '') {
      otherInput.style.display = 'block';
      otherInput.focus();
    } else {
      otherInput.style.display = 'none';
      otherInput.value = '';
    }
  });

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('input', () => {
      const fd = new FormData(contactForm);
      ui.draftContact = {
        _touched: true,
        name: fd.get('name') || '',
        email: fd.get('email') || '',
        phone: fd.get('phone') || '',
        birthDate: fd.get('birthDate') || '',
        relationship: fd.get('relationship') || '',
        'relationship-other': fd.get('relationship-other') || '',
        roleInform: contactForm.querySelector('[name="role-inform"]')?.checked ?? true,
        roleVerify: contactForm.querySelector('[name="role-verify"]')?.checked ?? false,
      };
    });
    contactForm.addEventListener('change', () => {
      const fd = new FormData(contactForm);
      ui.draftContact = {
        _touched: true,
        name: fd.get('name') || '',
        email: fd.get('email') || '',
        phone: fd.get('phone') || '',
        birthDate: fd.get('birthDate') || '',
        relationship: fd.get('relationship') || '',
        'relationship-other': fd.get('relationship-other') || '',
        roleInform: contactForm.querySelector('[name="role-inform"]')?.checked ?? true,
        roleVerify: contactForm.querySelector('[name="role-verify"]')?.checked ?? false,
      };
    });
    contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(contactForm);
    const roles = [];
    if (fd.get('role-inform')) roles.push('inform');
    if (fd.get('role-verify')) roles.push('verify');
    const relationship = (fd.get('relationship') || '').trim() || (fd.get('relationship-other') || '').trim();
    const { data, error } = await supabase.from('contacts').insert({
      account_id: state.account.id,
      name: (fd.get('name') || '').trim(),
      email: (fd.get('email') || '').trim(),
      relationship,
      address: (fd.get('address') || '').trim(),
      birth_date: (fd.get('birthDate') || '').trim(),
      phone: (fd.get('phone') || '').trim(),
      roles: roles.length ? roles : ['inform'],
    }).select().single();
    if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
    const saved = rowToContact(data);
    state.contacts.push(saved);
    syncCurrentSignupRecord();
    saveLocalDemoState();
    ui.addingContact = false;
    ui.draftContact = {};
    ui.contactInvitePreview = saved;
    render();
    // Niet-blokkerend: de uitnodigingsmail mag de UI niet ophouden. Mislukt deze, dan blijft
    // het contact zelf gewoon opgeslagen; de gebruiker ziet de preview-modal als bevestiging.
    // supabase-js stuurt automatisch het JWT van de ingelogde gebruiker mee als Authorization-
    // header (vereist, want deze Edge Function draait met verify_jwt: true).
    supabase.functions.invoke('send-contact-invite', { body: { contactId: saved.id } })
      .catch(err => console.error('send-contact-invite aanroep mislukt', err));
  });
  } // end if (contactForm)

  document.querySelectorAll('[data-action="delete-contact"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) { flashToast('Verwijderen is niet gelukt, probeer het opnieuw.'); return; }
      state.contacts = state.contacts.filter(c => c.id !== id);
      syncCurrentSignupRecord();
      saveLocalDemoState();
      render();
    });
  });

  const personalInfoForm = document.getElementById('personal-info-form');
  if (personalInfoForm) personalInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wasComplete = personalInfoComplete();
    const fd = new FormData(personalInfoForm);
    const info = {
      fullName: (fd.get('fullName') || '').trim(),
      street: (fd.get('street') || '').trim(),
      postalCode: (fd.get('postalCode') || '').trim(),
      city: (fd.get('city') || '').trim(),
      birthDate: toIsoDate((fd.get('birthDate') || '').trim()),
      phone: (fd.get('phone') || '').trim(),
    };
    const { error } = await supabase.from('profiles').update({
      full_name: info.fullName, street: info.street, postal_code: info.postalCode,
      city: info.city, birth_date: info.birthDate, phone: info.phone,
    }).eq('id', state.account.id);
    if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
    state.personalInfo = info;
    // Eerste keer dat de gegevens compleet zijn: ga automatisch door naar Bezittingen,
    // in plaats van op dit formulier te blijven staan.
    if (!wasComplete && personalInfoComplete()) state.view = 'assets';
    syncCurrentSignupRecord();
    saveLocalDemoState();
    render();
    flashToast('Gegevens opgeslagen');
  });

  const instrText = document.getElementById('instructions-text');
  if (instrText) {
    let debounceTimer;
    instrText.addEventListener('input', () => {
      state.instructions = instrText.value;
      const indicator = document.getElementById('save-indicator');
      if (indicator) indicator.textContent = 'Bezig met opslaan…';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const { error } = await supabase.from('profiles').update({ instructions: state.instructions }).eq('id', state.account.id);
        if (indicator) indicator.textContent = error ? 'Opslaan mislukt' : 'Opgeslagen';
        syncCurrentSignupRecord();
        saveLocalDemoState();
      }, 600);
    });
  }

  const downloadReportBtn = document.querySelector('[data-action="download-report-pdf"]');
  if (downloadReportBtn) downloadReportBtn.addEventListener('click', () => downloadReportPDF());

  document.querySelectorAll('[data-action="view-certificate"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const path = btn.getAttribute('data-path');
      const { data } = supabase.storage.from('death-certificates').getPublicUrl(path);
      if (data?.publicUrl) window.open(data.publicUrl, '_blank');
      else flashToast('Kon document-URL niet ophalen.');
    });
  });

  document.querySelectorAll('[data-action="approve-death-report"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Weet je zeker dat je de informatie wilt vrijgeven? Dit stuurt direct een e-mail naar alle contacten met de rol "Informatie ontvangen".')) return;
      btn.disabled = true; btn.textContent = 'Bezig…';
      const { error } = await supabase.rpc('approve_death_report', { p_account_id: id });
      if (error) {
        flashToast('Vrijgave mislukt: ' + error.message);
        btn.disabled = false; btn.textContent = 'Informatie vrijgeven';
      } else {
        flashToast('Informatie is vrijgegeven en e-mails zijn verstuurd.');
        await loadSignups(); render();
      }
    });
  });

  const copyContactEmailsBtn = document.querySelector('[data-action="copy-contact-emails"]');
  if (copyContactEmailsBtn) copyContactEmailsBtn.addEventListener('click', () => {
    const emails = [...new Set(
      (state.signups || []).flatMap(s => (s.contacts || []).map(c => (c.email || '').trim()).filter(Boolean))
    )].join(', ');
    navigator.clipboard.writeText(emails).then(() => flashToast('E-mailadressen gekopieerd.')).catch(() => flashToast('Kopiëren mislukt.'));
  });

  document.querySelectorAll('[data-action="toggle-faq"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      ui.openFaqIndex = ui.openFaqIndex === idx ? null : idx;
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-signup"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      ui.openSignupId = ui.openSignupId === id ? null : id;
      render();
    });
  });

  const deathReportForm = document.getElementById('death-report-form');
  if (deathReportForm) deathReportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(deathReportForm);
    const deceasedName = (fd.get('deceasedName') || '').trim();
    const deceasedEmail = (fd.get('deceasedEmail') || '').trim();
    const relationship = (fd.get('relationship') || '').trim() || (fd.get('relationship-other') || '').trim();
    const reporterName = (fd.get('reporterName') || '').trim();
    const reporterEmail = (fd.get('reporterEmail') || '').trim();
    const reporterPhone = (fd.get('reporterPhone') || '').trim();
    const message = (fd.get('message') || '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = {};
    if (!deceasedName) errors.deceasedName = true;
    if (!emailPattern.test(deceasedEmail)) errors.deceasedEmail = true;
    if (!reporterName) errors.reporterName = true;
    if (!emailPattern.test(reporterEmail)) errors.reporterEmail = true;
    if (Object.keys(errors).length) {
      ui.deathReportErrors = errors;
      ui.deathReportResult = null;
      render();
      setTimeout(() => { const el = document.getElementById('meld-overlijden'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
      return;
    }
    ui.deathReportErrors = null;
    ui.deathReportSubmitting = true;
    render();
    ui.deathReportResult = await reportDeathViaSupabase({ deceasedName, deceasedEmail, relationship, reporterName, reporterEmail, reporterPhone, message });
    ui.deathReportSubmitting = false;
    render();
    setTimeout(() => { const el = document.getElementById('meld-overlijden'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
  });

  const drRelationshipSelect = document.getElementById('dr-relationship');
  if (drRelationshipSelect) drRelationshipSelect.addEventListener('change', () => {
    const otherInput = document.getElementById('dr-relationship-other');
    if (!otherInput) return;
    if (drRelationshipSelect.value === '') {
      otherInput.style.display = 'block';
      otherInput.focus();
    } else {
      otherInput.style.display = 'none';
      otherInput.value = '';
    }
  });

  const simDeathWaitBtn = document.querySelector('[data-action="sim-death-wait-elapsed"]');
  if (simDeathWaitBtn) simDeathWaitBtn.addEventListener('click', () => simulateWaitingElapsedForSignup(simDeathWaitBtn.getAttribute('data-id')));

  document.querySelectorAll('[data-action="close-invite-preview"]').forEach(el => {
    el.addEventListener('click', () => { ui.contactInvitePreview = null; render(); });
  });

  const waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('wl-name')?.value || '').trim();
    const email = (document.getElementById('wl-email')?.value || '').trim();
    ui.waitlistEmailError = '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ui.waitlistEmailError = 'Vul een geldig e-mailadres in.'; render(); return; }

    if (!supabase) { flashToast('Supabase niet beschikbaar.'); return; }
    const { data: isBypass } = await supabase.rpc('is_bypass_email', { check_email: email });
    if (isBypass) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { name: name || email.split('@')[0] } },
      });
      if (error) { ui.waitlistEmailError = 'Er ging iets mis bij het versturen van de inloglink.'; render(); return; }
      ui.magicLinkSentTo = email;
      render();
      return;
    }

    state.waitlist = state.waitlist || [];
    state.waitlist.push({ id: Math.random().toString(36).slice(2), name, email, createdAt: new Date().toISOString() });
    ui.waitlistJoined = true;
    saveLocalDemoState();
    render();

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'form-name': 'waitlist', name, email }).toString(),
    }).catch(() => { /* stille fallback, lokale wachtlijst-weergave blijft werken */ });
  });
}
})();
