// AfterFile app.js — build 2026-08-01 09:46:35
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
// te vinden. Wachtwoorden worden gemaskeerd weergegeven.
const ASSET_CATEGORIES = [
  { key: 'financial', label: 'Financieel', types: [
      { key: 'bank', label: 'Bankrekening', icon: 'bank', namePlaceholder: 'bijv. Betaalrekening ING', extraFields: [
          { key: 'bankName', label: 'Bank', placeholder: 'bijv. ING, Rabobank, ABN AMRO' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'crypto', label: 'Crypto', icon: 'diamond', namePlaceholder: 'bijv. Bitcoin wallet Ledger', extraFields: [
          { key: 'walletType', label: 'Soort wallet of platform', placeholder: 'bijv. hardware wallet (Ledger), Coinbase-account' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'broker', label: 'Broker', icon: 'trending-up', namePlaceholder: 'bijv. Beleggingsrekening DEGIRO', extraFields: [
          { key: 'platform', label: 'Naam broker of platform', placeholder: 'bijv. DEGIRO, Saxo Bank, eToro' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'pension', label: 'Pensioen', icon: 'umbrella', namePlaceholder: 'bijv. Pensioen via werkgever', extraFields: [
          { key: 'provider', label: 'Pensioenuitvoerder', placeholder: 'bijv. ABP, ASR, BrightPensioen' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
  ]},
  { key: 'digital', label: 'Digitaal', types: [
      { key: 'website', label: 'Website', icon: 'globe', namePlaceholder: 'bijv. Persoonlijke blog of bedrijfswebsite', extraFields: [
          { key: 'url', label: 'Website URL', placeholder: 'bijv. www.mijnwebsite.nl' },
          { key: 'registrar', label: 'Registrar / domeinbeheerder', placeholder: 'bijv. Mijndomein.nl, TransIP, Vimexx' },
          { key: 'loginEmail', label: 'Inlogmailadres', placeholder: 'bijv. naam@voorbeeld.nl' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'domain', label: 'Domeinnaam', icon: 'link', namePlaceholder: 'bijv. mijnwebsite.nl', extraFields: [
          { key: 'registrar', label: 'Registrar / domeinbeheerder', placeholder: 'bijv. Mijndomein.nl, TransIP, Vimexx' },
          { key: 'loginEmail', label: 'Inlogmailadres', placeholder: 'bijv. naam@voorbeeld.nl' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'cloud', label: 'Cloudopslag', icon: 'cloud', namePlaceholder: 'bijv. Google Drive opslag', extraFields: [
          { key: 'provider', label: 'Provider', placeholder: 'bijv. Google Drive, Dropbox, iCloud' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'email', label: 'E-mailaccount', icon: 'mail', namePlaceholder: 'bijv. Gmail prive', extraFields: [
          { key: 'provider', label: 'Provider', placeholder: 'bijv. Gmail, Outlook, Proton Mail' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
  ]},
  { key: 'practical', label: 'Praktisch', types: [
      { key: 'phone', label: 'Telefoon', icon: 'phone', namePlaceholder: 'bijv. iPhone 15 Pro', extraFields: [
          { key: 'brand', label: 'Merk en model', placeholder: 'bijv. Apple iPhone 15 Pro' },
          { key: 'pinCode', label: 'Pincode', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'laptop', label: 'Laptop', icon: 'laptop', namePlaceholder: 'bijv. MacBook Pro werk', extraFields: [
          { key: 'brand', label: 'Merk en model', placeholder: 'bijv. Apple MacBook Pro 14"' },
          { key: 'password', label: 'Inlogwachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'email', label: 'E-mail', icon: 'mail', namePlaceholder: 'bijv. Persoonlijk e-mailaccount', extraFields: [
          { key: 'provider', label: 'Provider', placeholder: 'bijv. Gmail, Outlook, Proton Mail' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
  ]},
  { key: 'other', label: 'Overig', types: [
      { key: 'safe', label: 'Kluis', icon: 'safe', namePlaceholder: 'bijv. Brandkast slaapkamer', extraFields: [
          { key: 'keyHolder', label: 'Wie heeft toegang of de sleutel', placeholder: 'bijv. ligt bij de buren, in de meterkast' },
          { key: 'password', label: 'Code of combinatie', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'documents', label: 'Fysieke documenten', icon: 'document', namePlaceholder: 'bijv. Testament bij notaris', extraFields: [
          { key: 'documentType', label: 'Type document', placeholder: 'bijv. testament, paspoort, eigendomsbewijs' },
          { key: 'password', label: 'Wachtwoord', placeholder: 'Optioneel', type: 'password' },
      ]},
      { key: 'password-manager', label: 'Wachtwoordmanager', icon: 'key', namePlaceholder: 'bijv. Mijn wachtwoordkluis', extraFields: [
          { key: 'app', label: 'Welke app', placeholder: 'bijv. 1Password, Bitwarden, LastPass' },
          { key: 'keyLocation', label: 'Waar staat de masterkey / emergency kit', placeholder: 'bijv. in een envelop bij de notaris, in de kluis thuis' },
          { key: 'password', label: 'Masterpassword', placeholder: 'Optioneel, alleen als je hem hier wilt bewaren', type: 'password' },
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
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L17 13l4 1.5v3C21 19.3 19 21 17.5 21 9 21 3 15 3 6.5 3 5 5 3 6.5 3z"></path>',
  laptop: '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M1 21h22"></path>',
  download: '<path d="M12 4v11"></path><path d="M7.5 11 12 15.5 16.5 11"></path><path d="M5 19h14"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"></path>',
  users: '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path><circle cx="17.5" cy="9" r="2.3"></circle><path d="M15.3 19c.2-2.1 1.7-3.8 3.6-4.4"></path>',
  'chevron-down': '<path d="M6 9l6 6 6-6"></path>',
  'chevron-right': '<path d="M9 6l6 6-6 6"></path>',
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

const TRUST_LINE = 'Jouw digitale nalatenschap veilig geregeld.';

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
    adminProfiles: null,
  };
}

// ---------- Supabase ----------
// Project URL en publishable key zijn geen geheimen (RLS beperkt sowieso wat elke gebruiker
// kan zien/doen), dus veilig om hier in de clientcode te zetten.
const SUPABASE_URL = 'https://prkwfuiadjfpdmcorfas.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hqegYtKJNyF6z09_-kXcUg_nJMfkXW3';

// ============================================================
// VAULT — driedelige sleutelsplitsing + AES-256-GCM
// Fragment A: localStorage  |  B: Supabase  |  C: email contact
// Elke 2 van 3 fragmenten reconstrueren sleutel K
// ============================================================
const VK_FRAG_A  = 'af_v_fragA';   // localStorage: fragment A (base64)
const VK_FRAG_C  = 'af_v_fragC';   // localStorage: fragment C (base64) — voor kluiscontact
const VK_BLOB_ID = 'af_v_blobId';  // localStorage: vault_data id (voor auto-unlock)
const VK_DATA_LS  = 'af_v_data';    // localStorage: cache van ontsleutelde data
const VK_CONTACT  = 'af_v_contact';  // localStorage: email kluiscontact (legacy)

// ── GF(256) aritmetiek (onherleidbaar poly 0x11b) ──
function gfMul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}
function gfInv(a) {
  if (!a) return 0;
  let r = 1, x = a;
  // a^254 = a^-1 in GF(256)
  for (let i = 0; i < 7; i++) { r = gfMul(r, x); x = gfMul(x, x); }
  return gfMul(r, r); // a^127 * a^127 = a^254 = a^-1 (niet a^255)
}

// ── Driedelige splitsing (2 van 3 genoeg) ──
function sssShare(secret) {
  // secret = Uint8Array; geeft [s1,s2,s3] terug (x=1,2,3)
  const rand = crypto.getRandomValues(new Uint8Array(secret.length));
  const s1 = new Uint8Array(secret.length);
  const s2 = new Uint8Array(secret.length);
  const s3 = new Uint8Array(secret.length);
  for (let i = 0; i < secret.length; i++) {
    s1[i] = secret[i] ^ gfMul(rand[i], 1);
    s2[i] = secret[i] ^ gfMul(rand[i], 2);
    s3[i] = secret[i] ^ gfMul(rand[i], 3);
  }
  return [s1, s2, s3];
}
function sssReconstruct(xA, bytesA, xB, bytesB) {
  // Lagrange interpolatie op x=0 in GF(256)
  const n = bytesA.length;
  const secret = new Uint8Array(n);
  const denom = xA ^ xB;
  const lA = gfMul(xB, gfInv(denom));
  const lB = gfMul(xA, gfInv(denom));
  for (let i = 0; i < n; i++) {
    secret[i] = gfMul(bytesA[i], lA) ^ gfMul(bytesB[i], lB);
  }
  return secret;
}

// ── AES-256-GCM hulpfuncties ──
async function vkImportKey(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function vkEnc(key, text) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
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

// ── Opslaan/laden hulp ──
function u8ToB64(u8) { return btoa(String.fromCharCode(...u8)); }
function b64ToU8(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

// ── Snapshot van alle bezittingen opslaan (na elke wijziging) ──
async function vkSave() {
  if (!ui.vaultKey) return;
  const snapshot = {
    assets: state.assets || [],
    contacts: state.contacts || [],
    instructions: state.instructions || '',
    personalInfo: state.personalInfo || {},
    snapshotAt: new Date().toISOString()
  };
  ui.vaultData = snapshot;
  const blob = await vkEnc(ui.vaultKey, JSON.stringify(snapshot));
  if (supabase && state.account) {
    await supabase.from('vault_data').update({ encrypted_blob: blob }).eq('user_id', state.account.id);
  }
  localStorage.setItem(VK_DATA_LS, blob);
}

// ── Auto-unlock: Fragment A (lokaal) + Fragment B (server) → K ──
async function vkAutoUnlock() {
  const fragAb64 = sessionStorage.getItem(VK_FRAG_A);
  if (!fragAb64 || !supabase || !state.account) return false;
  try {
    const { data, error } = await supabase
      .from('vault_data').select('fragment_b, encrypted_blob').eq('user_id', state.account.id).single();
    if (error || !data) {
      // Supabase heeft geen vault_data meer — localStorage opruimen
      sessionStorage.removeItem(VK_FRAG_A);
      localStorage.removeItem(VK_CONTACT);
      localStorage.removeItem(VK_DATA_LS);
      return false;
    }
    const fragA = b64ToU8(fragAb64);
    const fragB = b64ToU8(data.fragment_b);
    const rawK  = sssReconstruct(1, fragA, 2, fragB);
    const key   = await vkImportKey(rawK);
    const plain = await vkDec(key, data.encrypted_blob);
    const snap  = JSON.parse(plain);
    ui.vaultKey   = key;
    ui.vaultData  = snap;
    ui.vaultState = 'unlocked';
    state.vaultContactEmail = localStorage.getItem(VK_CONTACT) || '';
    localStorage.setItem(VK_DATA_LS, data.encrypted_blob);
    return true;
  } catch { return false; }
}

// ── Initieel vault-state bepalen ──
async function vkInit() {
  state.vaultContactEmail = localStorage.getItem(VK_CONTACT) || '';
  const hasFragA = !!sessionStorage.getItem(VK_FRAG_A);
  if (!hasFragA) {
    // Check of er al een kluis bestaat in de DB (= ander apparaat, niet eerste setup)
    if (supabase && state.account) {
      const { data } = await supabase.from('vault_data').select('id').eq('user_id', state.account.id).maybeSingle();
      if (data) { ui.vaultState = 'locked'; render(); return; }
    }
    ui.vaultState = 'setup';
    render();
    return;
  }
  const ok = await vkAutoUnlock();
  if (!ok) {
    // vkAutoUnlock verwijdert VK_FRAG_A als er geen vault_data-rij in de DB is →
    // dan setup tonen, niet locked (anders werkt handmatig ontgrendelen ook nooit).
    ui.vaultState = sessionStorage.getItem(VK_FRAG_A) ? 'locked' : 'setup';
  }
  render();
}

// ── Vault vergrendelen ──
function vkLock() {
  if (ui.vaultLockTimer) clearTimeout(ui.vaultLockTimer);
  Object.assign(ui, { vaultKey: null, vaultData: null, vaultModal: null, vaultState: 'locked' });
  if (state.view === 'vault') render();
}
function vkResetTimer() {
  if (ui.vaultLockTimer) clearTimeout(ui.vaultLockTimer);
  ui.vaultLockTimer = setTimeout(vkLock, 10 * 60 * 1000); // 10 minuten
}


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
  const [{ data: profile, error: profileError }, { data: assets }, { data: contacts }, { data: lastPayments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('assets').select('*').eq('account_id', userId).order('created_at', { ascending: true }),
    supabase.from('contacts').select('*').eq('account_id', userId).order('created_at', { ascending: true }),
    supabase.from('payments').select('paid_at').eq('account_id', userId).eq('status', 'paid').order('paid_at', { ascending: false }).limit(1),
  ]);
  if (profileError || !profile) {
    if (attempt >= 3) {
      flashToast('Kon je profiel niet laden. Vernieuw de pagina en probeer opnieuw.');
      return;
    }
    await new Promise(r => setTimeout(r, 600));
    return loadAccountFromSupabase(userId, email, attempt + 1);
  }
  state.account = {
    id: userId,
    name: profile.name || email.split('@')[0],
    email: profile.email || email,
    plan: profile.plan,
    createdAt: profile.created_at,
    role: profile.role || 'user',
    subscriptionStatus: profile.subscription_status || null,
    currentPeriodEnd: profile.current_period_end || null,
    stripeSubscriptionId: profile.stripe_subscription_id || null,
    lastPaymentAt: (lastPayments && lastPayments[0]) ? lastPayments[0].paid_at : null,
    isFirstMover: profile.is_first_mover || false,
    billingPeriod: profile.billing_period || 'year',
  };
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
    ui.vaultState = 'loading';
  }
  if (state.account && ['landing', 'signup', 'waitlist'].includes(state.view)) state.view = 'dashboard';
  if (!state.account && ['dashboard', 'gegevens', 'assets', 'contacts', 'instructions', 'report', 'admin'].includes(state.view)) state.view = 'landing';
  render();
  // Start vault initialisatie na render (async — vkInit roept zelf render() aan als klaar)
  if (state.account) vkInit();
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

// Lees view= uit de URL-hash zodat publieke pagina's (bijv. vault-claim) direct laden.
// Voorbeeld: https://afterfile.nl#view=vault-claim?token=abc → state.view = 'vault-claim'
(function parseHashView() {
  const hash = window.location.hash.slice(1); // alles na '#'
  if (!hash) return;
  const beforeQ = hash.split('?')[0];          // "view=vault-claim"
  const p = new URLSearchParams(beforeQ);
  const v = p.get('view');
  if (v) state.view = v;
})();

let ui = { vaultState: 'loading', vaultKey: null, vaultData: null, vaultLockTimer: null, vaultKeyToShow: null, addingAssetType: null, addingCatOpen: null, addingAsset: false, addingContact: false, editingAssetId: null, editingContactId: null, vaultOpenCats: {}, vaultOpenAsset: null, draftAsset: {}, draftContact: {}, openFaqIndex: null, selectedPlanKey: null, billingPeriod: 'year', betalingOpen: false, signupEmailError: null, signupSubmitting: false, magicLinkSentTo: null, openSignupId: null, accountMenuOpen: false, contactInvitePreview: null, deathReportErrors: null, deathReportResult: null, deathReportSubmitting: false, waitlistEmailError: null, waitlistJoined: false, checkoutRedirecting: false, waitlistTab: 'waitlist', partnerFormSent: false, partnerFormError: null, cancelConfirming: false, billingPeriodSwitching: false };
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
  if (view === 'admin') state.adminProfiles = null; // trigger fresh load on each visit
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
function capitalizeWords(s) { return (s || '').replace(/\b\w/g, c => c.toUpperCase()); }
function flashToast(msg, durationMs) {
  durationMs = durationMs || 3000;
  let t = document.getElementById('af-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'af-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);background:#0F1222;color:#fff;font-size:13px;font-weight:500;padding:10px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.22);z-index:9999;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  clearTimeout(t._timer);
  // show
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }, durationMs);
}
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
    p_reporter_name:    details.reporterName,
    p_reporter_email:   details.reporterEmail,
    p_reporter_phone:   details.reporterPhone || '',
    p_deceased_name:    details.deceasedName || '',
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
      deceasedEmail: row.deceased_email || '',
      reporterName: details.reporterName,
      relationship: details.relationship || '',
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
      ${sub ? `<p>${sub}</p>` : ''}
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
    else if (state.view === 'vault-claim') html = renderVaultClaim();
    else html = renderLanding();
  } else {
    if (state.view === 'assets' && !personalInfoComplete()) {
      state.view = 'gegevens';
      saveState();
    }
    let content;
    switch (state.view) {
      case 'gegevens': content = renderPersonalInfo(); break;
      case 'assets': content = renderAssets(); break;
      case 'vault-claim': content = renderVaultClaim(); break;
      case 'contacts': content = renderContacts(); break;
      case 'instructions': content = renderInstructions(); break;
      case 'report': content = renderReport(); break;
      case 'faq': content = renderFaqPage(); break;
      case 'subscription': content = renderSubscription(); break;
      case 'admin': content = renderAdmin(); break;
      default: content = renderDashboard();
    }
    html = renderShell(content);
  }
  root.innerHTML = html;
  wireEvents();
}


function renderSiteFooter() {
  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <span class="site-footer-brand">
        <span class="brand-mark" style="display:inline-flex;vertical-align:middle;">${logoMark(20)}</span>
        <span>AfterFile</span>
      </span>
      <span class="site-footer-tagline">${esc(TRUST_LINE)}</span>
      <nav class="site-footer-links">
        <a href="#" data-nav="privacy">Privacyverklaring</a>
        <span class="site-footer-divider">·</span>
        <a href="mailto:info@afterfile.nl">info@afterfile.nl</a>
      </nav>
      <span class="site-footer-copy">© ${new Date().getFullYear()} AfterFile</span>
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
    'Je sleutel in drie stukken, niemand heeft er ooit genoeg alleen'
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
    { q: 'Hoe werkt de beveiliging van mijn gegevens?', a: 'Stel je voor: je sleutel wordt in drie stukjes geknipt. Stuk A blijft op jouw apparaat. Stuk B bewaren wij bij AfterFile. Stuk C sturen we naar het contact dat jij aanwijst. Om de kluis te openen heb je twee van die drie stukjes nodig, maar nooit alle drie tegelijk. Zolang je leeft opent jouw apparaat (A) samen met AfterFile (B) de kluis automatisch als je inlogt. Gebeurt er iets met jou? Dan stuurt AfterFile stuk B naar jouw contact. Dat contact combineert B met hun eigen stuk C, en ziet alles. Jouw apparaat is dan niet meer nodig. Niemand kan de kluis alleen openen: niet AfterFile, niet jouw contact, en ook een hacker die één stukje steelt heeft er niks aan.' },
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
            <h2>Niemand komt erbij, totdat het moet.</h2>
            <p>Beveiliging staat voorop, het is de basis van een betrouwbare digitale nalatenschap.</p>
          </div>
          <div class="security-grid">
            <div class="security-card">
              <div class="card-icon">${iconSvg('shield-check', 18)}</div>
              <h3>Versleuteld, altijd</h3>
              <p>Al je gegevens worden versleuteld opgeslagen en verzonden, op servers binnen de EU.</p>
            </div>
            <div class="security-card">
              <div class="card-icon">${iconSvg('lock', 18)}</div>
              <h3>Drie stukjes sleutel, niemand heeft er genoeg alleen</h3>
              <p>Jouw apparaat heeft stuk A. AfterFile heeft stuk B. Jouw contact krijgt stuk C. Twee stuks samen openen de kluis. Eén stuk alleen doet niks.</p>
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
              <h2>Werkt u in de financiële of juridische sector?</h2>
              <p>Word exclusief partner van AfterFile in uw regio.</p>
              <a href="#" class="btn btn-secondary" data-nav="partner" style="display:inline-flex;align-items:center;gap:6px;margin-top:4px;">Meer informatie voor partners ${iconSvg('chevron-right', 15)}</a>
            </div>
            <div class="partner-landing-right">
              <div class="partner-usp">${iconSvg('shield-check', 16)} <span><strong>Exclusief per regio</strong>, maximaal één partner per beroepsgroep</span></div>
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
  const hash   = window.location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const prefillToken = params.get('token') || '';

  return `
    <style>
      .dr-sections{display:flex;flex-direction:column;gap:40px;}
      .dr-divider{display:flex;align-items:center;gap:16px;margin:8px 0;}
      .dr-divider::before,.dr-divider::after{content:'';flex:1;height:1px;background:rgba(47,93,217,.12);}
      .dr-divider-label{font-size:11px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;}
      .dr-vault-card{background:#fff;border:1px solid rgba(47,93,217,.18);border-left:3px solid #2F5DD9;border-radius:10px;padding:24px 28px;}
      .dr-vault-token-hint{font-size:12px;color:#9AAAC8;margin-top:4px;line-height:1.5;}
    </style>
    <nav class="publicnav">
      <div class="publicnav-inner">
        <a href="#" class="brand" data-nav="landing"><span class="brand-mark">${logoMark(34)}</span> AfterFile</a>
        <div class="publicnav-links"><a href="#" data-nav="landing">Home</a></div>
      </div>
    </nav>
    <main class="page">
      <div class="container">
        <div class="dr-sections">

          <!-- Sectie 1: Overlijden melden -->
          <section class="report-death-section" id="meld-overlijden">
            <div class="section-heading">
              <span class="kicker">Voor vertrouwde contacten</span>
              <h2>Overlijden melden</h2>
              <p>Ben je door iemand toegevoegd als vertrouwd contact en is die persoon overleden? Meld dat hier. We vragen om basisgegevens om dit te kunnen verifiëren.</p>
            </div>
            <div class="inline-form-card report-death-card">
              <form id="death-report-form">
                <h4 class="report-death-subheading">Over de overledene</h4>
                <div class="field ${ui.deathReportErrors && ui.deathReportErrors.deceasedName ? 'invalid' : ''}">
                  <label for="dr-deceased-name">Naam overledene</label>
                  <input id="dr-deceased-name" name="deceasedName" type="text" placeholder="Volledige naam" autocapitalize="words">
                </div>

                <h4 class="report-death-subheading" style="margin-top:20px;">Jouw gegevens</h4>
                <div class="field-row">
                  <div class="field ${ui.deathReportErrors && ui.deathReportErrors.reporterName ? 'invalid' : ''}">
                    <label for="dr-reporter-name">Jouw naam</label>
                    <input id="dr-reporter-name" name="reporterName" type="text" placeholder="Jouw volledige naam" autocapitalize="words">
                  </div>
                  <div class="field ${ui.deathReportErrors && ui.deathReportErrors.reporterEmail ? 'invalid' : ''}">
                    <label for="dr-reporter-email">Jouw e-mailadres</label>
                    <input id="dr-reporter-email" name="reporterEmail" type="email" placeholder="jouw@voorbeeld.nl">
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

                ${(ui.deathReportErrors && Object.keys(ui.deathReportErrors).length) ? `<p class="field-error">Vul je naam en een geldig e-mailadres in.</p>` : ''}
                ${(ui.deathReportErrors && ui.deathReportErrors.certificate) ? `<p class="field-error">${esc(ui.deathReportErrors.certificate)}</p>` : ''}
                <div class="form-actions">
                  <button type="submit" class="btn btn-secondary" ${ui.deathReportSubmitting ? 'disabled' : ''}>${ui.deathReportSubmitting ? 'Bezig…' : 'Melding versturen'}</button>
                </div>
              </form>
            </div>
            ${renderDeathReportResult()}
          </section>

          <!-- Sectie 2: Kluis openen — alleen zichtbaar na goedkeuring (token vereist) -->
          ${prefillToken ? `<section class="report-death-section" id="kluis-openen">
            <div class="section-heading">
              <span class="kicker">Kluistoegang</span>
              <h2>Kluis openen</h2>
              <p>Heb je een toegangslink ontvangen van AfterFile? Voer je persoonlijke code in om de bezittingen te bekijken.</p>
            </div>
            <div class="dr-vault-card">
              <form id="dr-vault-claim-form">
                <div class="field" style="margin-bottom:14px;">
                  <label for="dr-vault-token" style="font-size:13px;font-weight:600;color:#0F1222;">Toegangslink of token</label>
                  <input id="dr-vault-token" type="text" value="${esc(prefillToken)}"
                    placeholder="Plak hier je link (https://afterfile.nl/#view=vault-claim?token=…) of alleen het token"
                    style="font-size:12px;font-family:monospace;">
                  <div class="dr-vault-token-hint">Je ontvangt deze link per e-mail zodra een overlijdensmelding is goedgekeurd.</div>
                </div>
                <div class="field" style="margin-bottom:16px;">
                  <label for="dr-vault-code" style="font-size:13px;font-weight:600;color:#0F1222;">Jouw persoonlijke code (Fragment C)</label>
                  <textarea id="dr-vault-code" rows="4"
                    placeholder="Plak hier de code uit de e-mail die je ontving toen je als kluiscontact werd aangewezen…"
                    style="font-family:monospace;font-size:11px;resize:none;"></textarea>
                </div>
                <p id="dr-vault-err" class="vk-err hidden"></p>
                <button type="submit" class="btn btn-secondary" style="display:flex;align-items:center;gap:6px;">
                  ${iconSvg('lock', 14)} Kluis openen
                </button>
              </form>
              <div id="dr-vault-result" class="hidden" style="margin-top:20px;"></div>
              <div class="claim-abc" style="margin-top:20px;">
                <span>${iconSvg('shield', 11)} Fragment B: AfterFile</span>
                <span>+</span>
                <span>${iconSvg('shield', 11)} Fragment C: jouw code</span>
                <span>=</span>
                <span>${iconSvg('check', 11)} Toegang</span>
              </div>
            </div>
          </section>` : ''}

        </div>
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
        </div>
        ${renderAccountMenu(v)}
      </div>
    </nav>
    <main class="page">
      <div class="container">${content}</div>
    </main>
    ${renderSiteFooter()}
    ${renderContactInviteModal()}
    ${renderDeleteContactModal()}
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
        <span class="nav-account-name">${esc(getFirstName())}</span>
        ${iconSvg('chevron-down', 16)}
      </button>
      ${open ? `
        <div class="account-menu-overlay"></div>
        <div class="account-menu-panel">
          ${menuLink('gegevens', 'Mijn gegevens')}
          ${menuLink('subscription', 'Mijn abonnement')}
          ${menuLink('report', 'Rapport')}
          ${menuLink('faq', 'FAQ')}
          ${state.account && state.account.role === 'owner' ? menuLink('admin', 'Beheer') : ''}
          <div class="account-menu-divider"></div>
          <button type="button" class="account-menu-link account-menu-logout" data-action="logout">Uitloggen</button>
        </div>
      ` : ''}
    </div>
  `;
}

function firstMoverDiscount(createdAt) {
  if (!createdAt) return 0;
  const joinYear = new Date(createdAt).getFullYear();
  const currentYear = new Date().getFullYear();
  return 5 + Math.max(0, currentYear - joinYear);
}

async function loadAdminProfiles() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('https://prkwfuiadjfpdmcorfas.supabase.co/functions/v1/manage-first-mover', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    state.adminProfiles = json.profiles || [];
    render();
  } catch (e) {
    console.error('loadAdminProfiles fout:', e);
    state.adminProfiles = [];
    render();
  }
}

function renderSubscription() {
  const plan = state.account ? state.account.plan : 'basis';
  const isBasis = plan === 'basis';
  const isCanceling = state.account && state.account.subscriptionStatus === 'canceling';
  const planData = PLANS.find(p => p.key === plan) || PLANS[0];
  const compleetData = PLANS.find(p => p.key === 'compleet');

  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '–';

  const since = fmtDate(state.account && state.account.createdAt);
  const lastPayment = fmtDate(state.account && state.account.lastPaymentAt);
  const periodEnd = fmtDate(state.account && state.account.currentPeriodEnd);

  const metaRows = [
    { label: 'Lid sinds', val: since },
    ...(plan !== 'basis' ? [
      { label: 'Laatste betaling', val: lastPayment },
      { label: isCanceling ? 'Toegang tot en met' : 'Volgende verlenging', val: periodEnd },
    ] : []),
  ].map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(47,93,217,.08);">
      <span style="font-size:13px;color:#9AAAC8;">${r.label}</span>
      <span style="font-size:13px;font-weight:600;color:#0F1222;">${r.val}</span>
    </div>`).join('');

  const statusBadge = isCanceling
    ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#FFF3CD;color:#92640A;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-left:10px;">Opgezegd</span>`
    : '';

  const planCard = `
    <div style="background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;padding:24px 28px;margin-bottom:20px;max-width:520px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Huidig pakket</div>
          <div style="display:flex;align-items:center;gap:0;">
            <span style="font-size:22px;font-weight:700;color:#0F1222;letter-spacing:-.02em;">${esc(planData.name)}</span>
            ${statusBadge}
          </div>
          <div style="font-size:13px;color:#9AAAC8;margin-top:2px;">${esc(planData.billing)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:24px;font-weight:700;color:#2F5DD9;letter-spacing:-.02em;">${esc(planData.price)}</div>
          <div style="font-size:12px;color:#9AAAC8;">${esc(planData.period)}</div>
        </div>
      </div>
      ${metaRows}
    </div>`;

  if (isBasis) {
    const upgradeCard = `
      <div style="background:linear-gradient(135deg,#2F5DD9 0%,#7A4DF0 100%);border-radius:8px;padding:24px 28px;max-width:520px;color:#fff;">
        <div style="font-size:16px;font-weight:700;margin-bottom:4px;">Upgrade naar Compleet</div>
        <div style="font-size:13px;opacity:.8;margin-bottom:18px;">${esc(compleetData.billing)}</div>
        <ul style="list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:7px;">
          ${compleetData.features.map(f => `<li style="font-size:13px;display:flex;align-items:flex-start;gap:8px;opacity:.92;">${iconSvg('check', 13)}<span>${esc(f)}</span></li>`).join('')}
        </ul>
        <button class="btn" style="background:#fff;color:#2F5DD9;font-weight:700;font-size:14px;" data-action="upgrade-plan" data-plan="compleet" ${ui.checkoutRedirecting ? 'disabled' : ''}>${ui.checkoutRedirecting ? 'Bezig...' : `Upgraden naar Compleet — ${esc(compleetData.price)}${esc(compleetData.period)}`}</button>
      </div>`;
    return `
      ${pageHeader({ kicker: 'Abonnement', title: 'Mijn abonnement.' })}
      ${planCard}
      ${upgradeCard}`;
  }

  const cancelCard = isCanceling
    ? `<div style="background:#FFF9EC;border:1px solid #F5C842;border-radius:8px;padding:20px 24px;max-width:520px;">
        <div style="font-size:14px;font-weight:700;color:#92640A;margin-bottom:6px;">Je abonnement is opgezegd</div>
        <div style="font-size:13px;color:#A07830;line-height:1.65;">
          Je houdt toegang tot al je gegevens tot en met <strong>${periodEnd}</strong>. Daarna wordt je account automatisch beëindigd. Je gegevens worden veilig bewaard totdat je ze zelf verwijdert.
        </div>
      </div>`
    : `<div style="background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;padding:24px 28px;max-width:520px;">
        <div style="font-size:14px;font-weight:700;color:#0F1222;margin-bottom:8px;">Abonnement opzeggen</div>
        <div style="font-size:13px;color:#9AAAC8;line-height:1.65;margin-bottom:18px;">
          Je abonnement wordt per einde van de lopende betaalperiode (${periodEnd}) beëindigd. Je behoudt tot die datum gewoon toegang. Je gegevens blijven veilig bewaard totdat je ze zelf verwijdert.
        </div>
        <button class="btn btn-secondary btn-sm" data-action="cancel-subscription" style="border-color:#E53E3E;color:#E53E3E;">Abonnement opzeggen</button>
      </div>`;

  const discount = state.account && state.account.isFirstMover ? firstMoverDiscount(state.account.createdAt) : 0;
  const firstMoverCard = discount > 0 ? (() => {
    const discountedPrice = (3.95 * (1 - discount / 100)).toFixed(2).replace('.', ',');
    return `
    <div style="background:linear-gradient(135deg,#0F1222 0%,#1A2240 100%);border-radius:8px;padding:22px 28px;max-width:520px;margin-bottom:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(47,93,217,.18);border-radius:50%;"></div>
      <div style="position:absolute;bottom:-30px;right:30px;width:60px;height:60px;background:rgba(122,77,240,.15);border-radius:50%;"></div>
      <div style="font-size:11px;font-weight:700;color:#7A8BB5;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">First Mover voordeel</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">Jouw loyaliteitskorting: ${discount}%</div>
      <div style="font-size:13px;color:#7A8BB5;margin-bottom:14px;line-height:1.5;">Je was er als een van de eersten. Als dank groeit jouw korting elk jaar automatisch met 1%.</div>
      <div style="display:flex;align-items:baseline;gap:10px;">
        <span style="font-size:13px;color:#7A8BB5;text-decoration:line-through;">€3,95/mnd</span>
        <span style="font-size:22px;font-weight:700;color:#2F5DD9;">€${discountedPrice}/mnd</span>
      </div>
    </div>`;
  })() : '';

  return `
    ${pageHeader({ kicker: 'Abonnement', title: 'Mijn abonnement.' })}
    ${firstMoverCard}
    ${planCard}
    ${cancelCard}`;
}

function renderFaqPage() {
  const faqs = [
    { q: 'Wat is AfterFile?', a: 'AfterFile is een veilige, persoonlijke plek om je digitale nalatenschap te regelen: je bezittingen, accounts en instructies vastgelegd voor de mensen die je vertrouwt, voor het moment dat jij dat zelf niet meer kan.' },
    { q: 'Hoe werkt de beveiliging van mijn gegevens?', a: 'Je sleutel wordt in drie stukjes geknipt. Stuk A blijft op jouw apparaat. Stuk B bewaren wij bij AfterFile. Stuk C sturen we naar het contact dat jij aanwijst. Om de kluis te openen heb je twee van die drie stukjes nodig, maar nooit alle drie tegelijk. Zolang je leeft opent jouw apparaat (A) samen met AfterFile (B) de kluis automatisch als je inlogt. Gebeurt er iets met jou? Dan stuurt AfterFile stuk B naar jouw contact. Dat contact combineert B met hun eigen stuk C, en ziet alles. Niemand kan de kluis alleen openen: niet AfterFile, niet jouw contact, en ook een hacker die één stukje steelt heeft er niks aan.' },
    { q: 'Wanneer krijgen mijn vertrouwde contacten toegang?', a: 'Een contact met de rol "Helpen bevestigen" kan via de "Overlijden melden"-link op de AfterFile-website een melding indienen met een officieel overlijdensbericht. AfterFile controleert dit en geeft de gegevens vrij aan contacten met de rol "Informatie ontvangen", doorgaans binnen 1 werkdag.' },
    { q: 'Hoe meldt een vertrouwd contact een overlijden?', a: 'Via de link "Voor Naasten" in de menubalk. Daar vult het contact de naam en het e-mailadres in waarmee de overledene bij AfterFile bekend was, samen met zijn of haar eigen naam en contactgegevens, zodat dit gecontroleerd kan worden.' },
    { q: 'Kan ik op elk moment opzeggen?', a: 'Ja. Je kunt je abonnement op elk moment stopzetten. Je gegevens blijven veilig bewaard totdat je ze zelf verwijdert.' },
    { q: 'Is de cloud niet onveiliger dan opslaan op mijn eigen apparaat?', a: 'Nee, en voor digitale nalatenschap geldt juist het omgekeerde. Apps die alles lokaal opslaan lossen het technische opslagprobleem op, maar creëren een groter probleem: hoe krijgen je naasten ooit toegang tot een bestand op een apparaat dat zij niet kennen, niet kunnen ontgrendelen, of dat al jaren geleden kapot is gegaan? AfterFile versleutelt je gegevens in de cloud (AES-256) én koppelt vrijgave aan een gecontroleerde verificatieprocedure. Zo zijn je gegevens tijdens je leven beschermd, en na je overlijden gegarandeerd bereikbaar voor de juiste mensen.' },
    { q: 'Welke betaalmethoden worden ondersteund?', a: 'We ondersteunen iDEAL, Visa en Mastercard.' },
    { q: 'Heb ik vragen of hulp nodig?', a: 'Stuur een e-mail naar info@afterfile.nl. We reageren doorgaans binnen één werkdag.' },
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
    ${pageHeader({ kicker: 'FAQ', title: 'Veelgestelde vragen.' })}
    <div class="faq-list" style="max-width:680px;margin-left:0;">${faqHtml}</div>
    <p style="margin-top:32px;font-size:14px;color:var(--color-text-muted);">Staat je vraag er niet bij? Mail naar <a href="mailto:info@afterfile.nl">info@afterfile.nl</a>.</p>
  `;
}

function renderDashboard() {
  const pct = computeCompletion();
  const a = state.assets.length, c = state.contacts.length;
  const infoComplete = personalInfoComplete();
  const ASSET_TARGET = 1, CONTACT_TARGET = 1;
  const todo = [];
  if (!infoComplete) todo.push({ label: 'Vul je persoonsgegevens aan', nav: 'gegevens' });
  if (a < ASSET_TARGET) { const n = ASSET_TARGET - a; todo.push({ label: `Voeg nog ${n} bezitting${n === 1 ? '' : 'en'} toe`, nav: 'assets' }); }
  if (c < CONTACT_TARGET) { const n = CONTACT_TARGET - c; todo.push({ label: `Voeg nog ${n} vertrouwd contact${n === 1 ? '' : 'en'} toe`, nav: 'contacts' }); }

  // Completion tracking
  if (pct >= 100 && !state.completedAt) {
    state.completedAt = Date.now();
    if (supabase) supabase.from('profiles').update({ completed_at: new Date(state.completedAt).toISOString() }).eq('id', state.account.id).then(() => {});
  } else if (pct < 100 && state.completedAt) {
    state.completedAt = null;
    if (supabase) supabase.from('profiles').update({ completed_at: null }).eq('id', state.account.id).then(() => {});
  }
  const showProgress = pct < 100;

  const firstName = getFirstName();
  const currentPlan = PLANS.find(p => p.key === state.account.plan);
  const planBadge = currentPlan ? ` &thinsp;<span style="display:inline-flex;align-items:center;padding:2px 10px;background:rgba(47,93,217,.1);color:#2F5DD9;border-radius:20px;font-size:11.5px;font-weight:600;vertical-align:middle;">${esc(currentPlan.name)}</span>` : '';

  // Voortgangsbalk (alleen zichtbaar zolang < 100%)
  const progressHtml = showProgress ? `
    <div style="border:1px solid rgba(47,93,217,.22);border-radius:8px;background:#fff;padding:14px 18px;margin-bottom:12px;display:flex;align-items:center;gap:16px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:600;color:#0F1222;margin-bottom:7px;">
          ${pct >= 100 ? 'Je nalatenschapsplan is compleet.' : `Je plan is ${pct}% compleet`}
        </div>
        <div style="height:4px;background:rgba(47,93,217,.15);border-radius:99px;">
          <div style="width:${pct}%;height:100%;background:#2F5DD9;border-radius:99px;"></div>
        </div>
        ${todo.length ? `<div style="margin-top:8px;">${todo.map(t => `<a href="#" data-nav="${t.nav}" style="display:inline-block;font-size:11.5px;font-weight:600;color:#2F5DD9;text-decoration:none;margin-right:14px;">${esc(t.label)} →</a>`).join('')}</div>` : ''}
      </div>
      <div style="font-size:20px;font-weight:700;color:#2F5DD9;flex-shrink:0;">${pct}%</div>
    </div>` : '';

  // Upgrade banner (horizontaal, compact)
  const upgradeBannerHtml = (state.account.plan === 'basis') ? `
    <div style="border:1px solid rgba(47,93,217,.22);border-radius:8px;background:#fff;padding:11px 18px;margin-bottom:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <span style="font-size:12px;color:#7A8BB5;">Upgrade naar Compleet voor onbeperkt bezittingen en een volledig Legacy Report.</span>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
        ${PLANS.filter(p => p.launchEligible).map(p => `
          <button type="button" style="padding:6px 14px;border-radius:6px;border:none;background:${p.featured ? '#2F5DD9' : 'rgba(47,93,217,.1)'};color:${p.featured ? '#fff' : '#2F5DD9'};font-size:12px;font-weight:600;cursor:pointer;" data-action="upgrade-plan" data-plan="${p.key}" ${ui.checkoutRedirecting ? 'disabled' : ''}>${ui.checkoutRedirecting ? 'Bezig…' : `${esc(p.name)} — ${esc(p.price)}${esc(p.period)}`}</button>
        `).join('')}
      </div>
    </div>` : '';

  // Kaart-helper — drie losse klikbare kaarten naast elkaar
  const card = (icon, title, sub, nav, actionLabel) => `
    <a href="#" data-nav="${nav}" class="dash-card" style="display:flex;flex-direction:column;padding:16px;gap:10px;text-decoration:none;background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;">
      <span style="color:#2F5DD9;display:flex;">${iconSvg(icon, 16)}</span>
      <span style="flex:1;">
        <span style="display:block;font-size:15px;font-weight:600;color:#0F1222;">${title}</span>
        <span style="display:block;font-size:13px;color:#9AAAC8;margin-top:2px;">${sub}</span>
      </span>
      <span style="font-size:13.5px;font-weight:600;color:#2F5DD9;">${actionLabel} →</span>
    </a>`;

  const gegevensSubtitle = infoComplete ? 'Persoonsgegevens ingevuld' : 'Nog niet ingevuld';
  const assetsSubtitle   = a === 0 ? 'Nog geen bezittingen' : `${a} bezitting${a === 1 ? '' : 'en'} toegevoegd`;
  const contactsSubtitle = c === 0 ? 'Nog geen contacten'  : `${c} contact${c === 1 ? '' : 'en'} toegevoegd`;

  return `
    <style>.dash-card{transition:box-shadow .18s ease,transform .18s ease;}.dash-card:hover{box-shadow:0 4px 16px rgba(47,93,217,.18);transform:translateY(-2px);}</style>
    ${pageHeader({ kicker: 'Dashboard', title: `Welkom terug, ${esc(firstName)}.`, sub: `Zo staat je plan er vandaag voor.${planBadge}` })}
    ${upgradeBannerHtml}
    ${progressHtml}
    <div style="background:linear-gradient(to bottom,#2F5DD9,transparent);border-radius:10px;padding:2px;margin-bottom:28px;">
      <div style="background:#EFF4FF;border-radius:9px;padding:11px;">
        <div class="dash-cards-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${card('info',   'Mijn gegevens',        gegevensSubtitle, 'gegevens', 'Aanpassen')}
          ${card('folder', 'Bezittingen',          assetsSubtitle,   'assets',   'Toevoegen')}
          ${card('users',  'Vertrouwde contacten', contactsSubtitle, 'contacts', 'Toevoegen')}
        </div>
      </div>
    </div>
  `;
}

function renderPersonalInfo() {
  const p = state.personalInfo || {};
  const complete = personalInfoComplete();
  return `
    <style>
      .pi-field{margin-bottom:12px;}
      .pi-field label{display:block;font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
      .pi-field input{width:100%;padding:6px 10px;font-size:13px;border:1px solid rgba(47,93,217,.22);border-radius:6px;background:#fff;color:#0F1222;outline:none;box-sizing:border-box;font-family:inherit;}
      .pi-field input:focus{border-color:#2F5DD9;box-shadow:0 0 0 2px rgba(47,93,217,.14);}
      .pi-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      @media(max-width:480px){.pi-row{grid-template-columns:1fr;}}
    </style>
    ${pageHeader({ kicker: 'Mijn gegevens', title: 'Leg je persoonsgegevens vast.', sub: 'We gebruiken dit om jouw plan aan jou te koppelen en op te nemen in je Legacy Report.' })}
    ${!complete ? `
      <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(47,93,217,.07);border:1px solid rgba(47,93,217,.22);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:12.5px;color:#2F5DD9;">
        <span style="flex-shrink:0;margin-top:1px;">${iconSvg('info', 15)}</span><span>Vul je gegevens hieronder volledig in, dit is nodig voordat je een bezitting kunt toevoegen.</span>
      </div>` : ''}
    <div style="background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;padding:20px 22px;">
      <div style="font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">Persoonlijke gegevens</div>
      <form id="personal-info-form">
        <div class="pi-row">
          <div class="pi-field">
            <label for="pi-fullname">Volledige naam</label>
            <input id="pi-fullname" name="fullName" type="text" placeholder="bijv. Sven Bakker" value="${esc(p.fullName)}" required autofocus autocapitalize="words">
          </div>
          <div class="pi-field">
            <label for="pi-birthdate">Geboortedatum</label>
            <input id="pi-birthdate" name="birthDate" type="text" inputmode="numeric" placeholder="DD-MM-JJJJ" pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}" value="${esc(toNlDate(p.birthDate))}" required>
          </div>
        </div>
        <div class="pi-field">
          <label for="pi-street">Straat en huisnummer</label>
          <input id="pi-street" name="street" type="text" placeholder="bijv. Hoofdstraat 12" value="${esc(p.street)}" required>
        </div>
        <div class="pi-row">
          <div class="pi-field">
            <label for="pi-postal">Postcode</label>
            <input id="pi-postal" name="postalCode" type="text" placeholder="bijv. 1234 AB" value="${esc(p.postalCode)}" required>
          </div>
          <div class="pi-field">
            <label for="pi-city">Woonplaats</label>
            <input id="pi-city" name="city" type="text" placeholder="bijv. Amsterdam" value="${esc(p.city)}" required>
          </div>
        </div>
        <div class="pi-field">
          <label for="pi-phone">Telefoonnummer</label>
          <input id="pi-phone" name="phone" type="tel" placeholder="bijv. 06 12345678" value="${esc(p.phone)}" required>
        </div>
        <div style="margin-top:18px;">
          <button type="submit" class="btn btn-primary">Gegevens opslaan</button>
        </div>
      </form>
    </div>
  `;
}

function vaultDialSvg(open = true) {
  const shackle = open
    ? 'M19,28 L19,22 Q19,12 28,12 Q37,12 37,22 L37,13'
    : 'M19,28 L19,22 Q19,12 28,12 Q37,12 37,22 L37,28';
  return `<svg width="52" height="52" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="pointer-events:none;display:block;">
<circle cx="28" cy="28" r="28" fill="#2F5DD9"/>
<path d="${shackle}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="3.5" stroke-linecap="round"/>
<rect x="15" y="26" width="26" height="18" rx="5" fill="rgba(255,255,255,.95)"/>
<circle cx="28" cy="34" r="3" fill="#2F5DD9"/>
<rect x="26.5" y="34" width="3" height="5" rx="1.2" fill="#2F5DD9"/>
</svg>`;
}

function renderAssets() {
  // ── Vault gate ──
  if (ui.vaultState === 'loading') {
    return `${pageHeader({ kicker: 'Bezittingen', title: 'Even laden…' })}<p style="color:var(--color-text-muted)">Kluis wordt geopend…</p>`;
  }
  if (ui.vaultState === 'showing-key') {
    return `
      ${pageHeader({ kicker: 'Bezittingen', title: 'Bewaar je sleutelcode.' })}
      <div class="vault-gate-card">
        ${iconSvg('key', 28)}
        <h3>Dit is jouw persoonlijke sleutelcode</h3>
        <p>AfterFile heeft deze code <strong>niet</strong>. Zonder hem kun je je bezittingen op een nieuw apparaat niet openen. Kopieer hem naar je wachtwoordmanager, of schrijf hem op en bewaar hem veilig.</p>
        <div class="vault-key-display" id="vk-key-display">${esc(ui.vaultKeyToShow || '')}</div>
        <button class="btn btn-primary" id="vk-key-saved-btn">Ik heb de code opgeslagen →</button>
      </div>`;
  }
  if (ui.vaultState === 'setup') {
    return `
      ${pageHeader({ kicker: 'Bezittingen', title: 'Activeer je kluis.' })}
      <div class="vault-gate-card">
        <div style="pointer-events:none;user-select:none;margin-bottom:8px;">${vaultDialSvg(false)}</div>
        <h3>Stel je kluis in om bezittingen te bewaren</h3>
        <p>Je ontvangt een persoonlijke sleutelcode die je zelf bewaart. Contactpersonen ontvangen hun kluiscode automatisch wanneer je ze toevoegt via de Contacten-pagina.</p>
        <form id="vk-setup-form" class="vault-setup-form">
          <button type="submit" class="btn btn-primary">Kluis aanmaken</button>
        </form>
      </div>`;
  }
  if (ui.vaultState === 'locked') {
    return `
      ${pageHeader({ kicker: 'Bezittingen', title: 'Jouw bezittingen.' })}
      <div style="background:linear-gradient(to bottom,#2F5DD9,transparent);border-radius:10px;padding:2px;max-width:520px;">
        <div style="background:#EFF4FF;border-radius:9px;padding:28px 32px 32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;">
            <div>
              <div style="font-size:15px;font-weight:700;color:#0F1222;letter-spacing:-.01em;">Kluis vergrendeld</div>
              <div style="font-size:13px;color:#9AAAC8;margin-top:2px;">Voer je sleutelcode in om toegang te krijgen.</div>
            </div>
            <div style="pointer-events:none;user-select:none;flex-shrink:0;opacity:.9;">${vaultDialSvg(false)}</div>
          </div>
          <div style="height:1px;background:rgba(47,93,217,.1);margin-bottom:20px;"></div>
          <form id="vk-unlock-form">
            <div style="font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Sleutelcode</div>
            <textarea id="vk-frag-a-input" rows="3" placeholder="Plak hier je sleutelcode…" style="width:100%;box-sizing:border-box;font-family:'Courier New',monospace;font-size:13px;resize:none;padding:10px 12px;border:1px solid rgba(47,93,217,.22);border-radius:6px;background:#fff;color:#0F1222;outline:none;"></textarea>
            <div id="vk-unlock-err" style="color:var(--color-danger);font-size:13px;display:none;margin-top:8px;">Ongeldige code. Controleer of je de juiste code hebt geplakt.</div>
            <button type="submit" class="btn btn-primary" style="margin-top:16px;">Kluis openen</button>
          </form>
        </div>
      </div>`;
  }
  // vaultState === 'unlocked' → normale bezittingen
  const adding = ui.addingAssetType;
  let formHtml = '';
  if (adding) {
    const cat = ASSET_CATEGORIES.find(c => c.key === adding.categoryKey);
    const type = findType(adding.categoryKey, adding.typeKey);
    const vf = (id, label, name, type2, placeholder, value, required = false) =>
      `<div class="vf">
        <label for="${id}">${label}${required ? '' : '<span class="vf-opt">(optioneel)</span>'}</label>
        <input id="${id}" name="${name}" type="${type2}" placeholder="${placeholder}" value="${esc(value)}"${required ? ' required autofocus' : ''}>
      </div>`;
    const extraFieldsHtml = (type.extraFields || []).map(ef =>
      vf(`as-${ef.key}`, esc(ef.label), ef.key, ef.type || 'text', esc(ef.placeholder || ''), ui.draftAsset[ef.key] || '')).join('');
    formHtml = `
      <div style="border:1px solid rgba(47,93,217,.22);border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 1px 6px rgba(15,25,70,.08);">
        <div style="display:flex;align-items:center;gap:9px;padding:10px 16px;background:#EFF4FF;border-bottom:1px solid rgba(47,93,217,.12);">
          <span style="color:#2F5DD9;flex-shrink:0;display:flex;">${iconSvg(type.icon, 14)}</span>
          <span style="font-size:13px;font-weight:700;color:#0F1222;flex:1;">${esc(type.label)}</span>
          <span style="font-size:10.5px;font-weight:600;color:#6B83C9;">${esc(cat.label)}</span>
        </div>
        <form id="asset-form" style="padding:14px 16px 16px;">
          ${vf('as-name', 'Naam', 'name', 'text', esc(type.namePlaceholder || 'bijv. naam van deze bezitting'), ui.draftAsset.name || '', true)}
          ${extraFieldsHtml}
          ${vf('as-description', 'Beschrijving', 'description', 'text', 'Een korte notitie', ui.draftAsset.description || '')}
          ${vf('as-location', 'Locatie', 'location', 'text', 'Waar het te vinden is', ui.draftAsset.location || '')}
          ${vf('as-notes', 'Notities', 'notes', 'text', 'Overige opmerkingen', ui.draftAsset.notes || '')}
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button type="submit" style="padding:7px 16px;border-radius:7px;border:none;background:#2F5DD9;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">${ui.editingAssetId ? 'Wijzigingen opslaan' : 'Bezitting opslaan'}</button>
            <button type="button" style="padding:7px 14px;border-radius:7px;border:1px solid rgba(47,93,217,.22);background:transparent;color:#7A8BB5;font-size:13px;font-weight:600;cursor:pointer;" data-action="cancel-asset">Annuleren</button>
          </div>
        </form>
      </div>
    `;
  }

  const catIconMap = { financial: 'bank', digital: 'globe', practical: 'phone', other: 'folder' };
  const catPickerHtml = ASSET_CATEGORIES.map(cat => {
    const isOpen = ui.addingCatOpen === cat.key;
    return `
      <div style="border:1px solid rgba(47,93,217,.22);border-radius:8px;margin-bottom:8px;overflow:hidden;background:#fff;box-shadow:0 1px 6px rgba(15,25,70,.08);">
        <div data-action="toggle-add-cat" data-cat="${cat.key}"
          style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;background:${isOpen ? '#E6EEFF' : '#EFF4FF'};">
          <span style="color:#2F5DD9;flex-shrink:0;display:flex;">${iconSvg(catIconMap[cat.key] || 'folder', 15)}</span>
          <span style="flex:1;font-size:13.5px;font-weight:700;color:#0F1222;">${esc(cat.label)}</span>
          <span style="color:#7A8BB5;flex-shrink:0;display:flex;align-items:center;transform:${isOpen ? 'rotate(90deg)' : 'none'};transition:transform .2s;">${iconSvg('chevron-right', 12)}</span>
        </div>
        ${isOpen ? `
          <div style="border-top:1px solid rgba(47,93,217,.12);background:#fff;">
            ${cat.types.map(t => `
              <div data-action="pick-asset-type" data-category="${cat.key}" data-type="${t.key}" class="add-type-row"
                style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-top:1px solid #EEF2FF;">
                <span style="color:#2F5DD9;opacity:.75;flex-shrink:0;display:flex;">${iconSvg(t.icon, 14)}</span>
                <span style="flex:1;font-size:13.5px;font-weight:600;color:#0F1222;">${esc(t.label)}</span>
                <span style="color:#C5CFEA;flex-shrink:0;display:flex;">${iconSvg('chevron-right', 11)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const hasAny = state.assets.length > 0;

  const listHtml = ASSET_CATEGORIES.map(cat => {
    const items = state.assets.filter(a => a.categoryKey === cat.key);
    if (!items.length) return '';
    const catOpen = (ui.vaultOpenCats || {})[cat.key] !== false;
    return `
      <div class="vault-cat${catOpen ? ' open' : ''}" style="border-radius:8px;border:1px solid rgba(47,93,217,.22);margin-bottom:8px;overflow:hidden;background:#fff;box-shadow:0 1px 6px rgba(15,25,70,.08);">
        <div class="vault-cat-hdr" data-action="toggle-vault-cat" data-cat="${cat.key}"
          style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;background:#EFF4FF;border-radius:0;">
          <span style="color:#2F5DD9;flex-shrink:0;display:flex;">${iconSvg(catIconMap[cat.key] || 'folder', 15)}</span>
          <span style="flex:1;font-size:13.5px;font-weight:700;color:#0F1222;">${esc(cat.label)}</span>
          <span style="font-size:11px;font-weight:700;color:#2F5DD9;background:rgba(47,93,217,.13);padding:2px 8px;border-radius:99px;">${items.length}</span>
          <span style="color:#7A8BB5;flex-shrink:0;display:flex;align-items:center;transition:transform .2s;" class="vault-cat-chevron">${iconSvg('chevron-right', 12)}</span>
        </div>
        ${catOpen ? `<div style="border-top:1px solid rgba(47,93,217,.12);background:#fff;">
          ${items.map(a => {
            const type = findType(a.categoryKey, a.typeKey);
            const assetOpen = ui.vaultOpenAsset === a.id;
            const detailRow = (label, val, pw = false) =>
              `<div style="padding:6px 0;border-bottom:1px solid #EEF2FF;">
                <div style="font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">${label}</div>
                <div style="font-size:13px;color:#0F1222;word-break:break-word;">${pw ? '••••••••' : val}</div>
              </div>`;
            const detailRows = [
              ...(type?.extraFields || []).filter(ef => (a.extra || {})[ef.key]).map(ef =>
                detailRow(esc(ef.label), esc(a.extra[ef.key]), ef.type === 'password')),
              a.description ? detailRow('Beschrijving', esc(a.description)) : '',
              a.location    ? detailRow('Locatie', esc(a.location)) : '',
              a.notes       ? detailRow('Notities', esc(a.notes)) : '',
            ].filter(Boolean);
            return `
              <div class="vault-asset-row${assetOpen ? ' open' : ''}" data-action="toggle-vault-asset" data-id="${a.id}"
                style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;background:${assetOpen ? '#EEF3FF' : 'transparent'};border-top:1px solid #EEF2FF;">
                <span style="color:#2F5DD9;opacity:.75;flex-shrink:0;display:flex;">${iconSvg(type?.icon || 'folder', 14)}</span>
                <span style="flex:1;font-size:13px;font-weight:600;color:#0F1222;">${esc(a.name)}</span>
                <span style="font-size:10.5px;font-weight:700;color:#4B6FD4;background:rgba(47,93,217,.1);padding:2px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0;">${esc(a.typeLabel)}</span>
                <span style="color:${assetOpen ? '#2F5DD9' : '#B0BCDA'};flex-shrink:0;display:flex;align-items:center;transform:${assetOpen ? 'rotate(90deg)' : 'none'};transition:transform .2s;">${iconSvg('chevron-right', 11)}</span>
              </div>
              ${assetOpen ? `<div style="padding:14px 16px 16px;background:#F8FAFF;border-top:1px solid rgba(47,93,217,.1);">
                ${detailRows.length ? detailRows.join('') : '<p style="font-size:13px;color:#7A8BB5;margin:0 0 8px;">Geen extra details opgeslagen.</p>'}
                <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #EEF2FF;">
                  <button class="btn-ghost btn-sm" data-action="edit-asset" data-id="${a.id}">Bewerken</button>
                  <button class="btn-danger-ghost" data-action="delete-asset" data-id="${a.id}">Verwijderen</button>
                </div>
              </div>` : ''}
            `;
          }).join('')}
        </div>` : ''}
      </div>
    `;
  }).join('');

  const vaShell = (content, showDial = true) => `
      <style>
        @keyframes vp{0%{box-shadow:0 0 0 0 rgba(47,93,217,.4)}70%{box-shadow:0 0 0 6px rgba(47,93,217,0)}100%{box-shadow:0 0 0 0 rgba(47,93,217,0)}}
        .vlb{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:8px;border:1px solid var(--color-border);background:transparent;color:var(--color-text-muted);font-size:14px;font-weight:600;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
        .vlb:hover{border-color:rgba(220,38,38,.3);color:#DC2626;background:rgba(220,38,38,.05)}
        .vsd{animation:vp 2.2s infinite}
        .add-type-row:hover{background:#F5F8FF;}
        .vf{margin-bottom:10px;}
        .vf label{display:block;font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
        .vf input{width:100%;padding:6px 10px;font-size:13px;border:1px solid rgba(47,93,217,.22);border-radius:6px;background:#fff;color:#0F1222;outline:none;box-sizing:border-box;font-family:inherit;}
        .vf input:focus{border-color:#2F5DD9;box-shadow:0 0 0 2px rgba(47,93,217,.14);}
        .vf-opt{font-size:10px;font-weight:400;color:#B0BCDA;text-transform:none;letter-spacing:0;margin-left:4px;}
      </style>
      <div class="va" style="border:2.5px solid transparent;border-radius:16px;padding:32px 32px 40px;background:linear-gradient(#FAFBFF,#F6F9FF) padding-box,linear-gradient(135deg,rgba(210,228,255,.97) 0%,rgba(47,93,217,.85) 14%,rgba(238,246,255,1) 29%,rgba(80,130,240,.38) 50%,rgba(225,238,255,.92) 68%,rgba(47,93,217,.75) 84%,rgba(200,222,255,.96) 100%) border-box;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 28px rgba(15,25,70,.09);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div style="flex:1;min-width:0;">${pageHeader({ kicker: 'Beveiligde kluis', title: (ui.addingAsset || ui.addingAssetType) ? (ui.editingAssetId ? 'Bezitting bewerken.' : 'Bezitting toevoegen.') : 'Jouw bezittingen.', sub: '' })}</div>
          ${showDial ? `<div class="vd-dial" style="flex-shrink:0;margin-top:4px;opacity:.9;pointer-events:none;user-select:none;">${vaultDialSvg()}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;padding:10px 16px;background:rgba(47,93,217,.05);border:1px solid rgba(47,93,217,.14);border-radius:8px;font-size:13px;font-weight:600;color:#2F5DD9;">
          <span class="vsd" style="width:8px;height:8px;border-radius:50%;background:#2F5DD9;flex:none;display:inline-block;"></span>
          <span>Kluis ontgrendeld</span>
        </div>
        ${content}
      </div>
    `;

  if (hasAny) {
    if (ui.addingAsset) {
      if (ui.addingAssetType) {
        return vaShell(`
          <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-asset" style="margin-bottom:20px;">← Terug naar categorieën</button>
          ${formHtml}
        `);
      }
      return vaShell(`
        <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-asset" style="margin-bottom:20px;">← Terug naar overzicht</button>
        ${catPickerHtml}
      `);
    }
    // Overzichtsscherm: lijst + knoppen
    return vaShell(`
        ${listHtml}
        <div style="margin-top:28px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <button type="button" class="btn btn-primary btn-sm" style="width:auto;" data-action="open-asset-picker">+ Bezitting toevoegen</button>
          <button type="button" class="vlb" data-action="vk-lock">${iconSvg('lock', 14)} Kluis verlaten</button>
        </div>
    `);
  } else {
    if (ui.addingAssetType) {
      return vaShell(`
        <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-asset" style="margin-bottom:20px;">← Terug naar categorieën</button>
        ${formHtml}
        <div style="margin-top:24px;display:flex;justify-content:flex-end;">
          <button type="button" class="vlb" data-action="vk-lock">${iconSvg('lock', 14)} Kluis verlaten</button>
        </div>
      `);
    }
    return vaShell(`
        ${catPickerHtml}
        <div class="empty-state">Nog geen bezittingen. Kies een categorie om je eerste toe te voegen.</div>
        <div style="margin-top:24px;display:flex;justify-content:flex-end;">
          <button type="button" class="vlb" data-action="vk-lock">${iconSvg('lock', 14)} Kluis verlaten</button>
        </div>
    `);
  }
}

// Voorbeeld-e-mail aan een nieuw vertrouwd contact: getoond als modal direct na het
// opslaan van een contact (zie het contact-formulier in wireEvents), zodat duidelijk is
// wat zo'n contact te zien zou krijgen. Er wordt in deze demo geen echte e-mail verzonden.
function renderDeleteContactModal() {
  const id = ui.confirmDeleteContactId;
  if (!id) return '';
  const contact = state.contacts.find(c => c.id === id);
  const name = contact ? esc(contact.name) : 'dit contact';
  return `
    <div id="delete-contact-modal" style="position:fixed;inset:0;background:rgba(15,18,34,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#fff;border-radius:12px;border:1px solid rgba(47,93,217,.18);max-width:400px;width:100%;padding:28px 28px 24px;box-shadow:0 12px 40px rgba(15,18,34,.18);">
        <div style="font-size:17px;font-weight:700;color:#0F1222;margin-bottom:8px;">Contact verwijderen</div>
        <div style="font-size:14px;line-height:1.6;color:#5B6880;margin-bottom:24px;">
          Weet je zeker dat je <strong style="color:#0F1222;">${name}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button data-action="cancel-delete-contact" style="font-size:13px;font-weight:600;color:#5B6880;background:transparent;border:1px solid rgba(0,0,0,.12);border-radius:7px;padding:8px 18px;cursor:pointer;">Annuleren</button>
          <button data-action="confirm-delete-contact" data-id="${id}" style="font-size:13px;font-weight:600;color:#fff;background:#DC3545;border:none;border-radius:7px;padding:8px 18px;cursor:pointer;">Verwijderen</button>
        </div>
      </div>
    </div>
  `;
}

function renderContactInviteModal() {
  const c = ui.contactInvitePreview;
  if (!c) return '';
  const accountName = ((state.personalInfo || {}).fullName || '').trim() || (state.account && state.account.name) || '';
  const rolesParas = [];
  if ((c.roles || []).includes('verify')) {
    rolesParas.push(`Je kunt een overlijden melden via de pagina "Overlijden melden" op afterfile.nl. Vul daar de naam en het e-mailadres van ${esc(accountName)} in, samen met je eigen gegevens ter verificatie.`);
  }
  if ((c.roles || []).includes('inform')) {
    rolesParas.push(`Zodra een overlijden is bevestigd en door AfterFile geverifieerd, ontvang je de gegevens die ${esc(accountName)} heeft vastgelegd.`);
  }
  const fragC = localStorage.getItem(VK_FRAG_C);
  const fragCHtml = fragC ? `
    <div style="margin:16px 0;padding:14px 16px;background:#EEF2FC;border-left:3px solid #2F5DD9;border-radius:6px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0F1222;">Jouw persoonlijke kluiscode</p>
      <p style="margin:0 0 10px;font-size:12px;color:#5B6172;">
        ${esc(accountName)} heeft je aangewezen als kluiscontact. Bewaar de onderstaande code veilig —
        je hebt hem nodig om toegang te krijgen tot de kluisinhoud van ${esc(accountName)} als dat moment aanbreekt.
      </p>
      <div style="font-family:monospace;font-size:12px;word-break:break-all;background:#fff;border:1px dashed #c7d2fe;border-radius:4px;padding:10px 12px;color:#1e293b;">${esc(fragC)}</div>
      <p style="margin:8px 0 0;font-size:11px;color:#9AA1B0;">
        Bewaar deze code in je wachtwoordmanager of druk hem af.<br>
        Als het zover is, ga je naar afterfile.nl en voer je de code in op de kluis-pagina van ${esc(accountName)}.
      </p>
    </div>` : '';
  return `
    <div class="invite-modal-overlay" data-action="close-invite-preview"></div>
    <div class="invite-modal" role="dialog" aria-modal="true" aria-label="Voorbeeld e-mail aan vertrouwd contact">
      <div class="invite-modal-top">
        <span>Contact opgeslagen — dit is de e-mail die verstuurd wordt</span>
        <button type="button" class="invite-modal-close" data-action="close-invite-preview" aria-label="Sluiten">${iconSvg('x', 16)}</button>
      </div>
      <div class="invite-mock">
        <div class="invite-mock-meta">
          <p><strong>Van:</strong> AfterFile &lt;info@afterfile.nl&gt;</p>
          <p><strong>Aan:</strong> ${esc(c.email)}</p>
          <p><strong>Onderwerp:</strong> ${esc(accountName)} heeft je toegevoegd als vertrouwd contact op AfterFile</p>
        </div>
        <div class="invite-mock-body">
          <p><strong>${esc(accountName)}</strong> heeft je toegevoegd als vertrouwd contact op <strong>AfterFile</strong>, een dienst voor het veilig vastleggen en overdragen van digitale nalatenschap.</p>
          ${rolesParas.map(p => `<p>• ${p}</p>`).join('')}
          ${fragCHtml}
          <p style="font-size:12px;color:#9AA1B0;">Vragen? Neem contact op met ${esc(accountName)} of stuur een e-mail naar info@afterfile.nl.</p>
        </div>
      </div>
      <div class="invite-modal-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="close-invite-preview">Sluiten</button>
      </div>
    </div>
  `;
}

// ── Publieke claim-pagina (voor kluiscontact na overlijden) ──
function renderVaultClaim() {
  const hash   = window.location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const token  = params.get('token') || '';

  return `
  <div class="claim-page">
    <div class="claim-header">
      <div class="claim-logo">${iconSvg('lock', 28)}</div>
      <h1>Toegang tot nalatenschap</h1>
      <p>Je hebt een beveiligde link ontvangen. Voer je persoonlijke code in om de bezittingen te bekijken.</p>
    </div>
    <div class="claim-card">
      <form id="vk-claim-form">
        <label class="vk-label">Jouw persoonlijke code</label>
        <textarea id="vk-claim-code" class="vk-input" rows="4"
          placeholder="Plak hier de code uit de e-mail die je ontving toen je als kluiscontact werd aangewezen..."
          style="font-family:monospace;font-size:11px;resize:none"></textarea>
        <input type="hidden" id="vk-claim-token" value="${esc(token)}" />
        <p id="vk-claim-err" class="vk-err hidden"></p>
        <button type="submit" class="vk-btn-primary" style="width:100%;margin-top:.5rem">
          ${iconSvg('lock', 14)} Bezittingen openen
        </button>
      </form>
      <div id="vk-claim-result" class="hidden"></div>
      <div class="claim-abc">
        <span>${iconSvg('shield', 11)} Fragment B: AfterFile</span>
        <span>+</span>
        <span>${iconSvg('shield', 11)} Fragment C: jouw code</span>
        <span>=</span>
        <span>${iconSvg('check', 11)} Toegang</span>
      </div>
    </div>
  </div>`;
}

// Render de onsleutelde snapshot voor het kluiscontact
function renderClaimSnapshot(snap) {
  const assets   = snap.assets   || [];
  const contacts = snap.contacts || [];
  const instr    = snap.instructions || '';
  const pi       = snap.personalInfo || {};
  const ts       = snap.snapshotAt ? new Date(snap.snapshotAt).toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric' }) : '';

  const assetRows = assets.length === 0
    ? '<p class="claim-empty">Geen bezittingen vastgelegd.</p>'
    : assets.map(a => `
      <div class="claim-item">
        <span class="claim-item-name">${esc(a.name || '')}</span>
        <span class="claim-item-cat">${esc(a.category || '')}</span>
        ${a.institution ? `<span class="claim-item-detail">${esc(a.institution)}</span>` : ''}
        ${a.value       ? `<span class="claim-item-detail">Waarde: ${esc(a.value)}</span>` : ''}
        ${a.notes       ? `<span class="claim-item-notes">${esc(a.notes)}</span>` : ''}
      </div>`).join('');

  const contactRows = contacts.length === 0
    ? '<p class="claim-empty">Geen contacten vastgelegd.</p>'
    : contacts.map(c => `
      <div class="claim-item">
        <span class="claim-item-name">${esc(c.name || '')}</span>
        <span class="claim-item-cat">${esc(c.relationship || '')} &bull; ${esc(c.role || '')}</span>
        ${c.email ? `<span class="claim-item-detail">${esc(c.email)}</span>` : ''}
        ${c.phone ? `<span class="claim-item-detail">${esc(c.phone)}</span>` : ''}
      </div>`).join('');

  return `
    <div class="claim-result-header">
      <div class="claim-unlocked-badge">${iconSvg('check', 16)} Kluis geopend</div>
      ${ts ? `<span class="claim-ts">Laatste update: ${ts}</span>` : ''}
    </div>
    ${pi.fullName ? `
    <div class="claim-section">
      <h3>Persoonlijke gegevens</h3>
      <div class="claim-item">
        <span class="claim-item-name">${esc(pi.fullName)}</span>
        ${pi.birthDate ? `<span class="claim-item-detail">Geboortedatum: ${esc(pi.birthDate)}</span>` : ''}
        ${pi.street    ? `<span class="claim-item-detail">${esc(pi.street)}, ${esc(pi.postalCode || '')} ${esc(pi.city || '')}</span>` : ''}
        ${pi.phone     ? `<span class="claim-item-detail">${esc(pi.phone)}</span>` : ''}
      </div>
    </div>` : ''}
    <div class="claim-section">
      <h3>Bezittingen (${assets.length})</h3>
      ${assetRows}
    </div>
    <div class="claim-section">
      <h3>Contactpersonen (${contacts.length})</h3>
      ${contactRows}
    </div>
    ${instr ? `
    <div class="claim-section">
      <h3>Instructies</h3>
      <div class="claim-instructions">${esc(instr).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
  `;
}



function renderContacts() {
  const initials = name => (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hasAny   = state.contacts.length > 0;
  const showForm = !hasAny || ui.addingContact;
  const isOtherRel = !RELATIONSHIP_SUGGESTIONS.includes(ui.draftContact.relationship || '') && ui.draftContact._touched;

  const formHtml = `
    <div style="background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;padding:20px 22px;margin-bottom:4px;">
      <div style="font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;">${ui.editingContactId ? 'Contact bewerken' : 'Contact toevoegen'}</div>
      <form id="contact-form">
        <div class="ct-row">
          <div class="ct-field">
            <label for="ct-name">Naam</label>
            <input id="ct-name" name="name" type="text" placeholder="bijv. Anna de Vries" value="${esc(ui.draftContact.name || '')}" required autofocus autocapitalize="words">
          </div>
          <div class="ct-field">
            <label for="ct-email">E-mailadres</label>
            <input id="ct-email" name="email" type="email" placeholder="anna@voorbeeld.nl" value="${esc(ui.draftContact.email || '')}" required>
          </div>
        </div>
        <div class="ct-row">
          <div class="ct-field">
            <label for="ct-relationship">Relatie</label>
            <select id="ct-relationship" name="relationship">
              ${RELATIONSHIP_SUGGESTIONS.map(r => `<option value="${esc(r)}" ${ui.draftContact.relationship === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
              <option value="" ${isOtherRel ? 'selected' : ''}>Anders…</option>
            </select>
            <input id="ct-relationship-other" name="relationship-other" type="text" placeholder="Vul je eigen relatie in" value="${esc(isOtherRel ? (ui.draftContact.relationship || '') : '')}" style="display:${isOtherRel ? 'block' : 'none'};margin-top:6px;width:100%;padding:6px 10px;font-size:13px;border:1px solid rgba(47,93,217,.22);border-radius:6px;background:#fff;color:#0F1222;outline:none;box-sizing:border-box;font-family:inherit;">
          </div>
          <div class="ct-field">
            <label for="ct-phone">Telefoon <span style="font-weight:400;color:#B0BCDA;">(optioneel)</span></label>
            <input id="ct-phone" name="phone" type="tel" placeholder="bijv. 06 12345678" value="${esc(ui.draftContact.phone || '')}">
          </div>
        </div>
        <div class="ct-row">
          <div class="ct-field">
            <label for="ct-address">Adres <span style="font-weight:400;color:#B0BCDA;">(optioneel)</span></label>
            <input id="ct-address" name="address" type="text" placeholder="bijv. Hoofdstraat 12, 1234 AB Amsterdam" value="${esc(ui.draftContact.address || '')}">
          </div>
          <div class="ct-field">
            <label for="ct-birthdate">Geboortedatum <span style="font-weight:400;color:#B0BCDA;">(optioneel)</span></label>
            <input id="ct-birthdate" name="birthDate" type="text" inputmode="numeric" placeholder="DD-MM-JJJJ" pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}" value="${esc(ui.draftContact.birthDate || '')}">
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Rollen</div>
          <label class="ct-role-opt">
            <input type="checkbox" name="role-inform" ${ui.draftContact._touched ? (ui.draftContact.roleInform !== false ? 'checked' : '') : 'checked'}>
            <span>Jouw informatie ontvangen</span>
          </label>
          <label class="ct-role-opt">
            <input type="checkbox" name="role-verify" ${ui.draftContact.roleVerify ? 'checked' : ''}>
            <span>Helpen bevestigen wat er is gebeurd</span>
          </label>
          <div style="font-size:11px;color:#9AAAC8;margin-top:8px;line-height:1.55;">Een contact met "Helpen bevestigen" kan via de "Overlijden melden"-pagina een officieel overlijdensbericht indienen. AfterFile controleert dit en geeft de gegevens vrij aan contacten met "Informatie ontvangen", doorgaans binnen 1 werkdag.</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="submit" class="btn btn-primary">${ui.editingContactId ? 'Wijzigingen opslaan' : 'Contact opslaan'}</button>
          ${hasAny ? `<button type="button" class="btn btn-ghost" data-action="cancel-contact">Annuleren</button>` : ''}
        </div>
      </form>
    </div>
  `;

  const listHtml = state.contacts.map(c => `
    <div class="ct-card">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
          <span style="font-size:14px;font-weight:700;color:#0F1222;">${esc(c.name)}</span>
          <span style="font-size:11px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.04em;">${esc(c.relationship || 'Contact')}</span>
        </div>
        <div style="font-size:12.5px;color:#5B6880;margin-top:3px;">${esc(c.email)}${c.phone ? '<span style="color:#C8D0E0;"> · </span>' + esc(c.phone) : ''}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;">
          ${c.roles.includes('inform') ? '<span class="ct-badge">Ontvangt informatie</span>' : ''}
          ${c.roles.includes('verify') ? '<span class="ct-badge ct-badge-verify">Helpt verifiëren</span>' : ''}
        </div>
      </div>
      <div class="ct-actions">
        <button class="ct-btn-edit" data-action="edit-contact" data-id="${c.id}">Bewerken</button>
        <button class="ct-btn-del" data-action="delete-contact" data-id="${c.id}">Verwijderen</button>
      </div>
    </div>
  `).join('');

  return `
    <style>
      .ct-field{margin-bottom:12px;}
      .ct-field label{display:block;font-size:10.5px;font-weight:600;color:#9AAAC8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
      .ct-field input,.ct-field select{width:100%;padding:6px 10px;font-size:13px;border:1px solid rgba(47,93,217,.22);border-radius:6px;background:#fff;color:#0F1222;outline:none;box-sizing:border-box;font-family:inherit;}
      .ct-field input:focus,.ct-field select:focus{border-color:#2F5DD9;box-shadow:0 0 0 2px rgba(47,93,217,.14);}
      .ct-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      @media(max-width:540px){.ct-row{grid-template-columns:1fr;}}
      .ct-role-opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(47,93,217,.22);border-radius:7px;background:#fff;margin-bottom:6px;cursor:pointer;font-size:12.5px;color:#0F1222;font-weight:500;}
      .ct-role-opt input{width:14px;height:14px;accent-color:#2F5DD9;flex-shrink:0;}
      .ct-card{display:flex;align-items:flex-start;gap:14px;background:#fff;border:1px solid rgba(47,93,217,.18);border-left:3px solid #2F5DD9;border-radius:8px;padding:14px 16px;margin-bottom:8px;transition:box-shadow .18s ease;}
      .ct-card:hover{box-shadow:0 3px 14px rgba(47,93,217,.14);}
      .ct-badge{font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:4px;background:#EFF4FF;color:#2F5DD9;border:1px solid rgba(47,93,217,.18);}
      .ct-badge-verify{background:#F5F0FF;color:#6B44C8;border-color:rgba(107,68,200,.2);}
      .ct-actions{display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-items:flex-end;}
      .ct-btn-edit{font-size:11.5px;color:#2F5DD9;background:#EFF4FF;border:1px solid rgba(47,93,217,.22);border-radius:5px;padding:4px 10px;cursor:pointer;font-weight:500;width:90px;text-align:center;}
      .ct-btn-edit:hover{background:rgba(47,93,217,.15);}
      .ct-btn-del{font-size:11.5px;color:#9AAAC8;background:transparent;border:1px solid rgba(0,0,0,.08);border-radius:5px;padding:4px 10px;cursor:pointer;width:90px;text-align:center;}
      .ct-btn-del:hover{color:#DC3545;border-color:rgba(220,53,69,.25);}
      .ct-add-btn{display:flex;align-items:center;gap:6px;margin-bottom:20px;font-size:13px;font-weight:600;color:#2F5DD9;background:transparent;border:1.5px solid rgba(47,93,217,.35);border-radius:7px;padding:8px 16px;cursor:pointer;width:fit-content;}
      @media(max-width:520px){
        .ct-card{flex-direction:column;gap:0;}
        .ct-actions{flex-direction:row;justify-content:flex-end;margin-top:12px;width:100%;align-items:center;}
        .ct-btn-edit,.ct-btn-del{flex:1;width:auto;}
      }
    </style>
    ${pageHeader({ kicker: 'Vertrouwde contacten', title: hasAny ? 'Jouw contacten.' : 'Kies wie geïnformeerd moet worden.', sub: 'Bepaal wie jouw gegevens ontvangt als dit nodig is.' })}
    ${hasAny ? `<div style="margin-bottom:4px;">${listHtml}</div>` : ''}
    ${hasAny && !showForm ? `<button type="button" class="ct-add-btn" data-action="open-contact-form">+ Contact toevoegen</button>` : ''}
    ${showForm ? formHtml : ''}
  `;
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
      <span><strong>Vergeet je wachtwoordmanager niet.</strong> Vermeld welke app je gebruikt (bijv. 1Password of Bitwarden) en waar je masterkey of emergency kit te vinden is, bij de notaris, in een kluis of in een envelop. AfterFile bewaart zelf nooit wachtwoorden.</span>
    </div>

  `;
}



function renderReport() {
  const isCompleet = state.account && state.account.plan !== 'basis';
  const pi = state.personalInfo || {};

  // Kaart met gekleurde sectie-header (dashboard-stijl)
  const sectionCard = (icon, title, content) => `
    <div style="background:#fff;border:1px solid rgba(47,93,217,.22);border-radius:8px;margin-bottom:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:rgba(47,93,217,.04);border-bottom:1px solid rgba(47,93,217,.1);">
        <div class="card-icon" style="width:28px;height:28px;border-radius:7px;box-shadow:0 3px 8px rgba(47,93,217,.22);">${iconSvg(icon, 13)}</div>
        <div style="font-size:14px;font-weight:700;color:#0F1222;letter-spacing:-.01em;">${title}</div>
      </div>
      <div style="padding:4px 20px 16px;">${content}</div>
    </div>`;

  const dataRow = (label, value) => !value ? '' : `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(47,93,217,.07);">
      <div style="font-size:11px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;min-width:110px;padding-top:2px;flex-shrink:0;">${label}</div>
      <div style="font-size:14px;color:#0F1222;">${value}</div>
    </div>`;

  const assetRow = a => `
    <div style="padding:12px 0;border-bottom:1px solid rgba(47,93,217,.07);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:600;color:#0F1222;">${esc(a.name)}</div>
        <div style="font-size:11px;font-weight:700;color:#2F5DD9;background:rgba(47,93,217,.09);padding:2px 8px;border-radius:20px;letter-spacing:.02em;">${esc(a.typeLabel)}</div>
      </div>
      ${a.location    ? `<div style="font-size:13px;color:#5B6880;margin-top:1px;">Locatie/login: <span style="color:#0F1222;">${esc(a.location)}</span></div>` : ''}
      ${a.institution ? `<div style="font-size:13px;color:#5B6880;margin-top:1px;">Instelling: <span style="color:#0F1222;">${esc(a.institution)}</span></div>` : ''}
      ${a.value       ? `<div style="font-size:13px;color:#5B6880;margin-top:1px;">Waarde: <span style="color:#0F1222;">${esc(a.value)}</span></div>` : ''}
      ${a.notes       ? `<div style="font-size:13px;color:#9AAAC8;margin-top:4px;font-style:italic;">${esc(a.notes)}</div>` : ''}
    </div>`;

  const contactRow = c => `
    <div style="padding:10px 0;border-bottom:1px solid rgba(47,93,217,.07);">
      <div style="font-size:14px;font-weight:600;color:#0F1222;">${esc(c.name)}<span style="font-weight:400;color:#9AAAC8;"> · ${esc(c.relationship || 'Contact')}</span></div>
      <div style="font-size:13px;color:#9AAAC8;margin-top:1px;">${esc(c.email)} · ${esc(rolesLabel(c.roles))}</div>
    </div>`;

  const empty = t => `<div style="font-size:13px;color:#9AAAC8;font-style:italic;padding:12px 0;">${t}</div>`;

  // Persoonlijke gegevens
  const adres = [pi.street, pi.postalCode, pi.city].filter(Boolean).join(', ');
  const piContent = [
    dataRow('Naam',          esc(pi.fullName || '')),
    dataRow('Adres',         adres ? esc(adres) : ''),
    dataRow('Geboortedatum', pi.birthDate ? esc(toNlDate(pi.birthDate)) : ''),
    dataRow('Telefoon',      esc(pi.phone || '')),
  ].join('') || empty('Nog geen persoonlijke gegevens ingevuld.');

  // Bezittingen
  const assetsContent = state.assets.length
    ? state.assets.map(assetRow).join('')
    : empty('Nog geen bezittingen toegevoegd.');

  // Contacten
  const contactsContent = state.contacts.length
    ? state.contacts.map(contactRow).join('')
    : empty('Nog geen vertrouwde contacten toegevoegd.');

  // Instructies
  const instrTxt = state.instructions.trim();
  const instrContent = instrTxt
    ? `<div style="font-size:14px;line-height:1.8;color:#0F1222;white-space:pre-wrap;padding-top:8px;">${esc(instrTxt)}</div>`
    : empty('Nog geen instructies geschreven.');

  // Proces
  const procesContent = `
    <div style="padding-top:8px;font-size:14px;line-height:1.75;color:#5B6880;">
      Een contact met de rol <strong style="color:#0F1222;">"Helpen bevestigen"</strong> kan via de <em>Overlijden melden</em>-pagina een melding indienen. AfterFile controleert dit en geeft de informatie vrij aan contacten met de rol <strong style="color:#0F1222;">"Informatie ontvangen"</strong>, doorgaans binnen 1 werkdag.
    </div>`;

  // PDF actie of upgrade-blok
  const actionHtml = isCompleet
    ? `<div style="margin-bottom:20px;">
        <button type="button" class="btn btn-primary" data-action="download-report-pdf" style="display:inline-flex;align-items:center;gap:8px;">
          ${iconSvg('file-text', 14)} Download als PDF
        </button>
      </div>`
    : `<div style="background:rgba(47,93,217,.05);border:1px solid rgba(47,93,217,.15);border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:160px;">
          <div style="font-size:13.5px;font-weight:600;color:#0F1222;">PDF beschikbaar in Compleet</div>
          <div style="font-size:12.5px;color:#9AAAC8;margin-top:2px;">Upgrade om je rapport als PDF op te slaan of te delen.</div>
        </div>
        <button type="button" class="btn btn-primary" data-action="nav" data-page="plan" style="white-space:nowrap;font-size:13px;">Bekijk abonnementen</button>
      </div>`;

  return `
    ${pageHeader({ kicker: 'Rapport', title: 'Alles op één plek, klaar om te delen.', sub: 'Een volledig overzicht voor familie, executeur of notaris.' })}
    ${actionHtml}
    ${sectionCard('key',       'Persoonlijke gegevens',            piContent)}
    ${sectionCard('safe',      'Digitale &amp; financiële bezittingen', assetsContent)}
    ${sectionCard('users',     'Vertrouwde contacten',             contactsContent)}
    ${instrTxt ? sectionCard('file-text', 'Instructies', instrContent) : ''}
  `;
}

function downloadReportPDF() {
  const p    = state.personalInfo || {};
  const name = p.fullName || 'Onbekend';
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  const adres = [p.street, p.postalCode, p.city].filter(Boolean).join(', ');

  const sec = (title, content) => `
    <div class="sec">
      <div class="sec-head">${title}</div>
      ${content}
    </div>`;

  const piRows = [
    p.fullName  ? `<div class="row"><span class="lbl">Naam</span><span>${esc(p.fullName)}</span></div>` : '',
    adres       ? `<div class="row"><span class="lbl">Adres</span><span>${esc(adres)}</span></div>` : '',
    p.birthDate ? `<div class="row"><span class="lbl">Geboortedatum</span><span>${esc(toNlDate(p.birthDate))}</span></div>` : '',
    p.phone     ? `<div class="row"><span class="lbl">Telefoon</span><span>${esc(p.phone)}</span></div>` : '',
  ].join('') || '<div class="empty">Geen gegevens ingevuld.</div>';

  const assetsHtml = state.assets.length
    ? state.assets.map(a => `
        <div class="item">
          <div class="item-title">${esc(a.name)} <span class="badge">${esc(a.typeLabel)}</span></div>
          ${a.location    ? `<div class="item-sub">Locatie/login: ${esc(a.location)}</div>` : ''}
          ${a.institution ? `<div class="item-sub">Instelling: ${esc(a.institution)}</div>` : ''}
          ${a.value       ? `<div class="item-sub">Waarde: ${esc(a.value)}</div>` : ''}
          ${a.notes       ? `<div class="item-note">${esc(a.notes)}</div>` : ''}
        </div>`).join('')
    : '<div class="empty">Geen bezittingen toegevoegd.</div>';

  const contactsHtml = state.contacts.length
    ? state.contacts.map(c => `
        <div class="item">
          <div class="item-title">${esc(c.name)}<span style="font-weight:400;color:#6B7A9A;"> · ${esc(c.relationship || 'Contact')}</span></div>
          <div class="item-sub">${esc(c.email)} · ${esc(rolesLabel(c.roles))}</div>
        </div>`).join('')
    : '<div class="empty">Geen contacten toegevoegd.</div>';

  const instrTxt = state.instructions.trim();

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Rapport – ${esc(name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; color: #0F1222; background: #fff; padding: 0; }

  /* Header */
  .header { background: #2F5DD9; padding: 28px 40px 24px; display: flex; align-items: center; justify-content: space-between; }
  .header-logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark { display: flex; align-items: center; justify-content: center; }
  .logo-name { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -.3px; }
  .header-meta { text-align: right; }
  .header-title { font-size: 15px; font-weight: 600; color: #fff; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,.65); margin-top: 2px; }

  /* Body */
  .body { padding: 32px 40px 48px; }

  /* Sections */
  .sec { margin-bottom: 28px; }
  .sec-head { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2F5DD9; border-bottom: 1.5px solid #2F5DD9; padding-bottom: 6px; margin-bottom: 12px; }

  /* Data rows (persoonlijke gegevens) */
  .row { display: flex; gap: 16px; padding: 7px 0; border-bottom: 1px solid #EEF1F8; font-size: 13px; }
  .lbl { font-weight: 600; color: #6B7A9A; min-width: 110px; flex-shrink: 0; }

  /* List items (bezittingen, contacten) */
  .item { padding: 10px 0; border-bottom: 1px solid #EEF1F8; }
  .item-title { font-size: 13.5px; font-weight: 600; color: #0F1222; margin-bottom: 2px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; color: #2F5DD9; background: #EFF4FF; padding: 1px 7px; border-radius: 20px; margin-left: 6px; vertical-align: middle; }
  .item-sub { font-size: 12px; color: #6B7A9A; margin-top: 2px; }
  .item-note { font-size: 12px; color: #9AAAC8; font-style: italic; margin-top: 3px; }
  .empty { font-size: 12px; color: #9AAAC8; font-style: italic; padding: 6px 0; }

  /* Instructies */
  .instructions { font-size: 13px; line-height: 1.75; color: #0F1222; white-space: pre-wrap; }

  /* Footer */
  .footer { border-top: 1px solid #EEF1F8; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 11px; color: #9AAAC8; }
  .footer-right { font-size: 11px; color: #9AAAC8; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-logo">
    <div class="logo-mark">${logoMark(36)}</div>
    <div class="logo-name">AfterFile</div>
  </div>
  <div class="header-meta">
    <div class="header-title">Digitale nalatenschap</div>
    <div class="header-sub">Opgesteld voor ${esc(name)} &nbsp;·&nbsp; ${date}</div>
  </div>
</div>

<div class="body">
  ${sec('Persoonlijke gegevens', piRows)}
  ${sec('Digitale &amp; financiële bezittingen', assetsHtml)}
  ${sec('Vertrouwde contacten', contactsHtml)}
  ${instrTxt ? sec('Instructies', `<div class="instructions">${esc(instrTxt)}</div>`) : ''}
</div>

<div class="footer">
  <div class="footer-left">AfterFile &mdash; afterfile.nl</div>
  <div class="footer-right">Bewaar dit document op een veilige plek.</div>
</div>

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

  // ── KPI's ────────────────────────────────────────────────────────────────
  const totalKlanten   = signups.length;
  const compleetCount  = signups.filter(s => s.plan !== 'basis').length;
  const basisCount     = totalKlanten - compleetCount;
  const mrr            = (compleetCount * 3.95).toFixed(2).replace('.', ',');
  const pendingReports = signups.filter(s => (s.checkins || {}).status === 'waiting').length;
  const avgAssets      = totalKlanten ? (signups.reduce((t, s) => t + (s.assets || []).length, 0) / totalKlanten).toFixed(1) : '0';
  const avgContacts    = totalKlanten ? (signups.reduce((t, s) => t + (s.contacts || []).length, 0) / totalKlanten).toFixed(1) : '0';
  const profileFilled  = signups.filter(s => {
    const p = s.personalInfo || {};
    return ['fullName','street','postalCode','city','birthDate','phone'].every(k => (p[k]||'').trim());
  }).length;

  const kpiCard = (label, value, sub, color) => `
    <div style="background:#fff;border:1px solid rgba(47,93,217,.18);border-radius:8px;padding:18px 20px;flex:1;min-width:120px;">
      <div style="font-size:11px;font-weight:700;color:#9AAAC8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${label}</div>
      <div style="font-size:26px;font-weight:700;color:${color || '#0F1222'};letter-spacing:-.02em;line-height:1;">${value}</div>
      ${sub ? `<div style="font-size:12px;color:#9AAAC8;margin-top:4px;">${sub}</div>` : ''}
    </div>`;

  const kpisHtml = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
      ${kpiCard('Klanten', totalKlanten, `${compleetCount} Compleet · ${basisCount} Basis`)}
      ${kpiCard('MRR', `€${mrr}`, `${compleetCount} betalend`,'#2F5DD9')}
      ${kpiCard('Gem. bezittingen', avgAssets, 'per klant')}
      ${kpiCard('Gem. contacten', avgContacts, 'per klant')}
      ${kpiCard('Profiel ingevuld', profileFilled, `van ${totalKlanten} klanten`)}
      ${pendingReports ? kpiCard('Openstaand', pendingReports, 'te beoordelen melding(en)', '#C4453F') : ''}
    </div>`;

  // ── Klantenrijen ─────────────────────────────────────────────────────────
  const completionPct = s => {
    let done = 0, total = 4;
    const p = s.personalInfo || {};
    if (['fullName','street','postalCode','city','birthDate','phone'].every(k => (p[k]||'').trim())) done++;
    if ((s.assets || []).length > 0) done++;
    if ((s.contacts || []).length > 0) done++;
    if ((s.instructions || '').trim()) done++;
    return Math.round((done / total) * 100);
  };

  const pctBadge = pct => {
    const color = pct === 100 ? '#1F9D5C' : pct >= 50 ? '#2F5DD9' : '#9AAAC8';
    return `<span style="font-size:11px;font-weight:700;color:${color};background:${color}18;padding:2px 8px;border-radius:20px;">${pct}% compleet</span>`;
  };

  const statusBadge = s => {
    const ci = (s.checkins || {}).status || 'active';
    if (ci === 'waiting') return `<span style="font-size:11px;font-weight:700;color:#C4453F;background:#FCEEED;padding:2px 8px;border-radius:20px;">⚠ Melding ingediend</span>`;
    if (ci === 'shared')  return `<span style="font-size:11px;font-weight:700;color:#1F9D5C;background:#EDFAF4;padding:2px 8px;border-radius:20px;">✓ Vrijgegeven</span>`;
    return '';
  };

  const rowsHtml = signups.length ? signups.map(s => {
    const open = ui.openSignupId === s.id;
    const p = s.personalInfo || {};
    const infoFilled = ['fullName', 'street', 'postalCode', 'city', 'birthDate', 'phone'].every(k => (p[k] || '').trim().length > 0);
    const assets = s.assets || [];
    const contacts = s.contacts || [];
    const instr = (s.instructions || '').trim();
    const ci = s.checkins || { status: 'active' };
    const pct = completionPct(s);
    return `
      <div class="admin-row ${open ? 'open' : ''}">
        <button type="button" class="admin-row-summary" data-action="toggle-signup" data-id="${s.id}">
          <div class="admin-row-main">
            <strong>${esc(s.name)}</strong>
            <span class="admin-row-email">${esc(s.email)}</span>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
              <span class="admin-pill admin-pill--${s.plan}">${esc(planLabel(s.plan))}</span>
              ${pctBadge(pct)}
              ${statusBadge(s)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;font-size:12px;color:#9AAAC8;">
            <span>${esc(formatDate(new Date(s.createdAt)))}</span>
            <span>${assets.length} bezitting${assets.length !== 1 ? 'en' : ''} · ${contacts.length} contact${contacts.length !== 1 ? 'en' : ''}</span>
          </div>
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
              ${assets.length ? assets.map(a => `<p class="meta-row"><strong>${esc(a.name)}</strong> · ${esc(a.typeLabel)}${a.location ? ` · ${esc(a.location)}` : ''}</p>`).join('') : `<p class="meta-row faint">Nog geen bezittingen.</p>`}
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('users', 14)} Contacten (${contacts.length})</h4>
              ${contacts.length ? contacts.map(c => `<p class="meta-row"><strong>${esc(c.name)}</strong> · ${esc(c.email)} · ${esc(rolesLabel(c.roles))}</p>`).join('') : `<p class="meta-row faint">Nog geen contacten.</p>`}
            </div>
            <div class="admin-detail-block">
              <h4>${iconSvg('file-text', 14)} Instructies</h4>
              <p class="meta-row${instr ? '' : ' faint'}">${instr ? esc(instr) : 'Nog niet geschreven.'}</p>
            </div>
            ${ci.reportedBy ? `
            <div class="admin-detail-block">
              <h4>${iconSvg('info', 14)} Overlijdensmelding</h4>
              <p class="meta-row"><strong>Gemeld door:</strong> ${esc(ci.reportedBy.name)} (${esc(ci.reportedBy.email)})${ci.reportedBy.phone ? ` · ${esc(ci.reportedBy.phone)}` : ''}</p>
              ${ci.reportedBy.message ? `<p class="meta-row faint">${esc(ci.reportedBy.message)}</p>` : ''}
              ${ci.reportedBy.certificatePath ? `<p class="meta-row"><a href="#" data-action="view-certificate" data-path="${esc(ci.reportedBy.certificatePath)}" style="color:var(--color-primary);">Akte bekijken →</a></p>` : `<p class="meta-row faint">Geen akte geüpload.</p>`}
              ${ci.status === 'waiting' ? `<div style="margin-top:10px;"><button type="button" class="btn btn-primary btn-sm" data-action="approve-death-report" data-id="${s.id}">Informatie vrijgeven</button></div>` : ''}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div class="empty-state">Nog geen aanmeldingen.</div>`;

  // ── First Movers (Supabase) ───────────────────────────────────────────────
  let firstMoversHtml = '';
  if (state.adminProfiles === null) {
    // Trigger async load, show spinner
    loadAdminProfiles();
    firstMoversHtml = `<div style="color:#9AAAC8;font-size:13px;padding:16px 0;">Klanten laden...</div>`;
  } else {
    const profiles = state.adminProfiles;
    const planLabel2 = (key) => { const p = PLANS.find(pl => pl.key === key); return p ? p.name : (key || 'Basis'); };
    const profileRows = profiles.map(p => {
      const disc = firstMoverDiscount(p.created_at);
      const fmBadge = p.is_first_mover
        ? `<span style="font-size:11px;font-weight:700;color:#2F5DD9;background:#EFF4FF;padding:2px 8px;border-radius:20px;">First Mover ${disc}%</span>`
        : '';
      const subBadge = p.subscription_status === 'canceling'
        ? `<span style="font-size:11px;font-weight:700;color:#92640A;background:#FFF3CD;padding:2px 8px;border-radius:20px;">Opgezegd</span>`
        : p.subscription_status === 'active' && p.plan !== 'basis'
        ? `<span style="font-size:11px;font-weight:700;color:#1F9D5C;background:#EDFAF4;padding:2px 8px;border-radius:20px;">Actief</span>`
        : '';
      const endDate = p.current_period_end
        ? new Date(p.current_period_end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(47,93,217,.08);flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-size:14px;font-weight:600;color:#0F1222;">${esc(p.name || p.email)}</div>
            <div style="font-size:12px;color:#9AAAC8;">${esc(p.email)}</div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
              <span class="admin-pill admin-pill--${p.plan || 'basis'}">${esc(planLabel2(p.plan))}</span>
              ${fmBadge}
              ${subBadge}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            ${endDate ? `<span style="font-size:12px;color:#9AAAC8;">tot ${endDate}</span>` : ''}
            <button type="button" class="btn btn-sm ${p.is_first_mover ? 'btn-secondary' : ''}"
              style="font-size:12px;padding:5px 12px;"
              data-action="toggle-first-mover"
              data-id="${esc(p.id)}"
              data-value="${p.is_first_mover ? 'false' : 'true'}">
              ${p.is_first_mover ? 'First Mover verwijderen' : 'First Mover maken'}
            </button>
          </div>
        </div>`;
    }).join('');

    const fmCount = profiles.filter(p => p.is_first_mover).length;
    firstMoversHtml = `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:#0F1222;">Klanten (${profiles.length}) · <span style="color:#2F5DD9;">${fmCount} First Mover${fmCount !== 1 ? 's' : ''}</span></h3>
        </div>
        ${profileRows || '<div class="empty-state">Nog geen klanten.</div>'}
      </div>`;
  }

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
    ${pageHeader({ kicker: 'Beheer', title: 'Klantoverzicht.', sub: 'Realtime inzicht in aanmeldingen, voortgang en openstaande acties.' })}

    ${kpisHtml}

    ${PRELAUNCH_MODE ? `
      <h3 style="margin:0 0 12px;">Wachtlijst (${waitlist.length})</h3>
      ${partnerTableHtml}
      ${waitlistHtml}
      <div class="section-divider"></div>
    ` : ''}

    ${firstMoversHtml}

    <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0F1222;">Activiteit (${signups.length})</h3>
    <div class="admin-list">${rowsHtml}</div>
    ${contactsOverviewHtml ? `<div class="section-divider"></div>${contactsOverviewHtml}` : ''}
  `;
}

// ---------- events ----------
function wireEvents() {

  // --- Kluis (SSS setup via dashboard) ---
  const vkSetupForm = document.getElementById('vk-setup-form');
  if (vkSetupForm) {
    vkSetupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = vkSetupForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Even geduld...';

      const rawK = crypto.getRandomValues(new Uint8Array(32));
      const [fragA, fragB, fragC] = sssShare(rawK);
      const key  = await vkImportKey(rawK);

      // Initieel snapshot van huidige bezittingen
      const snapshot = {
        assets: state.assets || [],
        contacts: state.contacts || [],
        instructions: state.instructions || '',
        personalInfo: state.personalInfo || {},
        snapshotAt: new Date().toISOString()
      };
      const blob = await vkEnc(key, JSON.stringify(snapshot));

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/vault-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fragment_b: u8ToB64(fragB),
          encrypted_blob: blob,
          user_name: state.personalInfo?.fullName || state.account?.email || 'AfterFile gebruiker'
        })
      });

      if (res.ok) {
        // Pas na server-bevestiging opslaan: fragA en fragB blijven altijd in sync.
        // Schrijven vóór de API-call veroorzaakte een mismatch waardoor auto-unlock altijd faalde.
        sessionStorage.setItem(VK_FRAG_A, u8ToB64(fragA));
        localStorage.setItem(VK_FRAG_C, u8ToB64(fragC));
        ui.vaultKey      = key;
        ui.vaultData     = snapshot;
        ui.vaultKeyToShow = u8ToB64(fragA);
        ui.vaultState    = 'showing-key';
        localStorage.setItem(VK_DATA_LS, blob);
        render();
      } else {
        btn.disabled = false; btn.textContent = 'Kluis aanmaken';
        alert('Er ging iets mis bij het activeren van de kluis. Probeer opnieuw.');
      }
    });
  }

  // Sleutelcode opgeslagen bevestiging
  const vkKeySavedBtn = document.getElementById('vk-key-saved-btn');
  if (vkKeySavedBtn) {
    vkKeySavedBtn.addEventListener('click', () => {
      ui.vaultKeyToShow = null;
      ui.vaultState = 'unlocked';
      render();
    });
  }

  // Kluis verlaten / vergrendelen (verwijdert Fragment A, forceert herbevestiging met code)
  document.querySelectorAll('[data-action="vk-lock"]').forEach(btn => {
    btn.addEventListener('click', () => {
      sessionStorage.removeItem(VK_FRAG_A);
      Object.assign(ui, { vaultKey: null, vaultData: null, vaultState: 'locked' });
      render();
    });
  });

  // Vault unlock op nieuw apparaat (Fragment A invoeren)
  const vkUnlockForm = document.getElementById('vk-unlock-form');
  if (vkUnlockForm) {
    vkUnlockForm.addEventListener('submit', async e => {
      e.preventDefault();
      const input = (document.getElementById('vk-frag-a-input').value || '').trim();
      const errEl = document.getElementById('vk-unlock-err');
      errEl.style.display = 'none';
      const btn = vkUnlockForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Even geduld…';
      try {
        const fragA = b64ToU8(input);
        const { data, error } = await supabase.from('vault_data')
          .select('fragment_b, encrypted_blob, claim_token').eq('user_id', state.account.id).single();
        if (error || !data) throw new Error('Geen vault gevonden');
        const fragB = b64ToU8(data.fragment_b);
        const rawK  = sssReconstruct(1, fragA, 2, fragB);
        const key   = await vkImportKey(rawK);
        const plain = await vkDec(key, data.encrypted_blob);
        const snap  = JSON.parse(plain);
        // Opslaan in localStorage voor dit apparaat
        sessionStorage.setItem(VK_FRAG_A, input);
        ui.vaultKey   = key;
        ui.vaultData  = snap;
        ui.vaultState = 'unlocked';
        localStorage.setItem(VK_DATA_LS, data.encrypted_blob);
        render();
      } catch {
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Kluis openen';
      }
    });
  }

  // Kluis-claim op "Voor naasten" pagina (dr-vault-claim-form)
  const drVaultClaimForm = document.getElementById('dr-vault-claim-form');
  if (drVaultClaimForm) {
    drVaultClaimForm.addEventListener('submit', async e => {
      e.preventDefault();
      const rawToken  = document.getElementById('dr-vault-token').value.trim();
      const fragCb64  = document.getElementById('dr-vault-code').value.trim();
      const errEl     = document.getElementById('dr-vault-err');
      const resEl     = document.getElementById('dr-vault-result');
      errEl.classList.add('hidden');

      // Haal token op uit een geplakte URL of direct tokenwaarde
      let token = rawToken;
      if (rawToken.includes('token=')) {
        try { token = new URL(rawToken).searchParams.get('token') || rawToken.split('token=')[1]?.split('&')[0] || rawToken; }
        catch { token = rawToken.split('token=')[1]?.split('&')[0] || rawToken; }
      }

      if (!fragCb64 || !token) {
        errEl.textContent = 'Vul je toegangslink en persoonlijke code in.';
        errEl.classList.remove('hidden');
        return;
      }
      const btn = drVaultClaimForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Even geduld...';
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/vault-claim?token=${encodeURIComponent(token)}`);
        if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Fout bij ophalen.'); }
        const { fragment_b, encrypted_blob } = await res.json();
        const fragC = b64ToU8(fragCb64);
        const fragB = b64ToU8(fragment_b);
        const rawK  = sssReconstruct(2, fragB, 3, fragC);
        const key   = await vkImportKey(rawK);
        const plain = await vkDec(key, encrypted_blob);
        const snap  = JSON.parse(plain);
        drVaultClaimForm.classList.add('hidden');
        resEl.classList.remove('hidden');
        resEl.innerHTML = renderClaimSnapshot(snap);
      } catch(err) {
        errEl.textContent = err.message || 'Er ging iets mis. Controleer je link en code.';
        errEl.classList.remove('hidden');
        btn.disabled = false; btn.innerHTML = `${iconSvg('lock', 14)} Kluis openen`;
      }
    });
  }

  // Kluis-claim (publieke pagina voor contact na overlijden)
  const vkClaimForm = document.getElementById('vk-claim-form');
  if (vkClaimForm) {
    vkClaimForm.addEventListener('submit', async e => {
      e.preventDefault();
      const fragCb64 = document.getElementById('vk-claim-code').value.trim();
      const token    = document.getElementById('vk-claim-token').value.trim();
      const errEl    = document.getElementById('vk-claim-err');
      const resEl    = document.getElementById('vk-claim-result');
      errEl.classList.add('hidden');
      if (!fragCb64 || !token) {
        errEl.textContent = 'Vul je code in.'; errEl.classList.remove('hidden'); return;
      }
      const btn = vkClaimForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Even geduld...';
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/vault-claim?token=${encodeURIComponent(token)}`);
        if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Fout bij ophalen.'); }
        const { fragment_b, encrypted_blob } = await res.json();
        const fragC = b64ToU8(fragCb64);
        const fragB = b64ToU8(fragment_b);
        const rawK  = sssReconstruct(2, fragB, 3, fragC);
        const key   = await vkImportKey(rawK);
        const plain = await vkDec(key, encrypted_blob);
        const snap  = JSON.parse(plain);
        vkClaimForm.classList.add('hidden');
        resEl.classList.remove('hidden');
        resEl.innerHTML = renderClaimSnapshot(snap);
      } catch(err) {
        errEl.textContent = err.message || 'Er ging iets mis.';
        errEl.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Bezittingen openen';
      }
    });
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

  document.querySelectorAll('[data-action="toggle-first-mover"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-id');
      const newValue = btn.getAttribute('data-value') === 'true';
      btn.disabled = true;
      btn.textContent = 'Bezig...';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('https://prkwfuiadjfpdmcorfas.supabase.co/functions/v1/manage-first-mover', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId, is_first_mover: newValue }),
        });
        const json = await res.json();
        if (json.ok) {
          // Update local adminProfiles state
          if (state.adminProfiles) {
            const p = state.adminProfiles.find(x => x.id === targetId);
            if (p) p.is_first_mover = newValue;
          }
          flashToast(newValue ? 'First Mover status toegevoegd. Stripe-korting verwerkt.' : 'First Mover status verwijderd.');
          render();
        } else {
          flashToast(json.error || 'Er ging iets mis.');
          btn.disabled = false;
          btn.textContent = newValue ? 'First Mover maken' : 'First Mover verwijderen';
        }
      } catch (e) {
        flashToast('Er ging iets mis. Probeer opnieuw.');
        btn.disabled = false;
      }
    });
  });

  const cancelSubBtn = document.querySelector('[data-action="cancel-subscription"]');
  if (cancelSubBtn) {
    cancelSubBtn.addEventListener('click', async () => {
      if (!confirm('Weet je zeker dat je wilt opzeggen? Je behoudt toegang tot het einde van je betaalperiode.')) return;
      cancelSubBtn.disabled = true;
      cancelSubBtn.textContent = 'Bezig...';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('https://prkwfuiadjfpdmcorfas.supabase.co/functions/v1/cancel-subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (json.ok) {
          state.account.subscriptionStatus = 'canceling';
          flashToast('Abonnement opgezegd. Je behoudt toegang tot het einde van je betaalperiode.');
          render();
        } else {
          cancelSubBtn.disabled = false;
          cancelSubBtn.textContent = 'Abonnement opzeggen';
          flashToast(json.error || 'Er ging iets mis. Probeer opnieuw.');
        }
      } catch (e) {
        cancelSubBtn.disabled = false;
        cancelSubBtn.textContent = 'Abonnement opzeggen';
        flashToast('Er ging iets mis. Probeer opnieuw.');
      }
    });
  }

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
      ui.addingAssetType = { categoryKey, typeKey };
      render();
      setTimeout(() => { const el = document.getElementById('as-name'); if (el) el.focus(); }, 0);
    });
  });

  document.querySelectorAll('[data-action="cancel-asset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (ui.addingAssetType && !ui.editingAssetId) {
        ui.addingAssetType = null;
      } else {
        ui.addingAssetType = null;
        ui.addingAsset = false;
        ui.editingAssetId = null;
        ui.draftAsset = {};
        ui.addingCatOpen = null;
      }
      render();
    });
  });

  const openAssetPickerBtn = document.querySelector('[data-action="open-asset-picker"]');
  if (openAssetPickerBtn) openAssetPickerBtn.addEventListener('click', () => { ui.addingAsset = true; render(); });

  const cancelContactBtn = document.querySelector('[data-action="cancel-contact"]');
  if (cancelContactBtn) cancelContactBtn.addEventListener('click', () => { ui.addingContact = false; ui.editingContactId = null; ui.draftContact = {}; render(); });

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
    const payload = {
      name: (fd.get('name') || '').trim(),
      extra,
      description: (fd.get('description') || '').trim(),
      location: (fd.get('location') || '').trim(),
      notes: (fd.get('notes') || '').trim(),
    };
    if (ui.editingAssetId) {
      const { data, error } = await supabase.from('assets').update(payload).eq('id', ui.editingAssetId).select().single();
      if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
      state.assets = state.assets.map(a => a.id === ui.editingAssetId ? rowToAsset(data) : a);
      ui.editingAssetId = null;
    } else {
      const { data, error } = await supabase.from('assets').insert({
        account_id: state.account.id,
        category_key: categoryKey, type_key: typeKey, type_label: type.label,
        ...payload,
      }).select().single();
      if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
      state.assets.push(rowToAsset(data));
    }
    ui.addingAssetType = null;
    ui.addingAsset = false;
    ui.draftAsset = {};
    syncCurrentSignupRecord();
    saveLocalDemoState();
    render();
    flashToast('Bezitting opgeslagen');
  });
  } // end if (assetForm)

  document.querySelectorAll('[data-action="edit-asset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const a = state.assets.find(x => x.id === id);
      if (!a) return;
      ui.editingAssetId = id;
      ui.addingAsset = true;
      ui.addingAssetType = { categoryKey: a.categoryKey, typeKey: a.typeKey };
      ui.draftAsset = { name: a.name, description: a.description || '', location: a.location || '', notes: a.notes || '', ...(a.extra || {}) };
      render();
    });
  });

  document.querySelectorAll('[data-action="delete-asset"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) { flashToast('Verwijderen is niet gelukt, probeer het opnieuw.'); return; }
      state.assets = state.assets.filter(a => a.id !== id);
      if (ui.vaultOpenAsset === id) ui.vaultOpenAsset = null;
      syncCurrentSignupRecord();
      saveLocalDemoState();
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-add-cat"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      ui.addingCatOpen = ui.addingCatOpen === cat ? null : cat;
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-vault-cat"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      if (!ui.vaultOpenCats) ui.vaultOpenCats = {};
      const isOpen = ui.vaultOpenCats[cat] !== false;
      ui.vaultOpenCats[cat] = !isOpen;
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-vault-asset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      ui.vaultOpenAsset = ui.vaultOpenAsset === id ? null : id;
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
    const payload = {
      name: capitalizeWords((fd.get('name') || '').trim()),
      email: (fd.get('email') || '').trim(),
      relationship,
      address: (fd.get('address') || '').trim(),
      birth_date: (fd.get('birthDate') || '').trim(),
      phone: (fd.get('phone') || '').trim(),
      roles: roles.length ? roles : ['inform'],
    };
    if (ui.editingContactId) {
      const { data, error } = await supabase.from('contacts').update(payload).eq('id', ui.editingContactId).select().single();
      if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
      state.contacts = state.contacts.map(c => c.id === ui.editingContactId ? rowToContact(data) : c);
      ui.editingContactId = null;
      ui.addingContact = false;
      ui.draftContact = {};
      syncCurrentSignupRecord();
      saveLocalDemoState();
      render();
      flashToast('Contact opgeslagen');
    } else {
      const { data, error } = await supabase.from('contacts').insert({ account_id: state.account.id, ...payload }).select().single();
      if (error) { flashToast('Opslaan is niet gelukt, probeer het opnieuw.'); return; }
      const saved = rowToContact(data);
      state.contacts.push(saved);
      syncCurrentSignupRecord();
      saveLocalDemoState();
      ui.addingContact = false;
      ui.draftContact = {};
      ui.contactInvitePreview = saved;
      render();
      const _fragC = localStorage.getItem(VK_FRAG_C) || null;
      supabase.functions.invoke('send-contact-invite', { body: { contactId: saved.id, fragment_c: _fragC } })
        .catch(err => console.error('send-contact-invite aanroep mislukt', err));
      // Als dit de kluiscontact is (fragment_c aanwezig), sla hun e-mail op in vault_data
      // zodat na goedkeuring van een overlijdensmelding de toegangslink naar het juiste adres gaat.
      if (_fragC && saved.email) {
        supabase.from('vault_data').update({ contact_email: saved.email }).eq('user_id', state.account.id)
          .catch(err => console.error('vault_data contact_email update mislukt', err));
      }
    }
  });
  } // end if (contactForm)

  document.querySelectorAll('[data-action="edit-contact"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const c = state.contacts.find(x => x.id === id);
      if (!c) return;
      ui.editingContactId = id;
      ui.addingContact = true;
      ui.draftContact = {
        _touched: true,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        birthDate: c.birthDate || '',
        address: c.address || '',
        relationship: c.relationship || '',
        roleInform: (c.roles || []).includes('inform'),
        roleVerify: (c.roles || []).includes('verify'),
      };
      render();
    });
  });

  document.querySelectorAll('[data-action="delete-contact"]').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.confirmDeleteContactId = btn.getAttribute('data-id');
      render();
    });
  });

  const cancelDeleteBtn = document.querySelector('[data-action="cancel-delete-contact"]');
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => {
    ui.confirmDeleteContactId = null;
    render();
  });

  const confirmDeleteBtn = document.querySelector('[data-action="confirm-delete-contact"]');
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', async () => {
    const id = confirmDeleteBtn.getAttribute('data-id');
    ui.confirmDeleteContactId = null;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) { flashToast('Verwijderen is niet gelukt, probeer het opnieuw.'); return; }
    state.contacts = state.contacts.filter(c => c.id !== id);
    syncCurrentSignupRecord();
    saveLocalDemoState();
    render();
  });

  // Hoofdletters per woord op blur voor naamvelden
  ['ct-name', 'pi-fullname'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => { el.value = capitalizeWords(el.value); });
  });

  const personalInfoForm = document.getElementById('personal-info-form');
  if (personalInfoForm) personalInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wasComplete = personalInfoComplete();
    const fd = new FormData(personalInfoForm);
    const info = {
      fullName: capitalizeWords((fd.get('fullName') || '').trim()),
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
    else state.view = 'dashboard';
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
      if (!confirm('Weet je zeker dat je de informatie wilt vrijgeven? Dit stuurt direct een e-mail naar alle contacten met de rol "Informatie ontvangen" en een kluislink naar het kluiscontact.')) return;
      btn.disabled = true; btn.textContent = 'Bezig…';
      const { error } = await supabase.rpc('approve_death_report', { p_account_id: id });
      if (error) {
        flashToast('Vrijgave mislukt: ' + error.message);
        btn.disabled = false; btn.textContent = 'Informatie vrijgeven';
        return;
      }
      // Stuur kluistoegang-e-mail naar het kluiscontact
      const signup = (state.signups || []).find(s => s.id === id);
      const deceasedName = signup?.name || '';
      supabase.functions.invoke('send-vault-access', { body: { accountId: id, deceasedName } })
        .catch(err => console.error('send-vault-access mislukt', err));
      flashToast('Informatie is vrijgegeven en e-mails zijn verstuurd.');
      await loadSignups(); render();
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
    const reporterName = (fd.get('reporterName') || '').trim();
    const reporterEmail = (fd.get('reporterEmail') || '').trim();
    const reporterPhone = (fd.get('reporterPhone') || '').trim();
    const message = (fd.get('message') || '').trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = {};
    if (!deceasedName) errors.deceasedName = true;
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
    ui.deathReportResult = await reportDeathViaSupabase({ deceasedName, reporterName, reporterEmail, reporterPhone, message });
    ui.deathReportSubmitting = false;
    render();
    setTimeout(() => { const el = document.getElementById('meld-overlijden'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
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
      body: new URLSearchParams(Object.assign({"form-name":"waitlist"},formData)).toString()
    });
  });
}
})();
