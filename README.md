# AfterFile — clickable prototype

This is a front-end-only prototype to test the AfterFile MVP concept end to end. It is **not connected to any backend** — there's no real account system, no server, no database. Everything you enter is saved to your browser's local storage only, on your own machine.

## How to open it

Double-click `index.html`. It opens directly in your browser — no install, no server needed.

## What you can try

The whole app is in Dutch — the landing page now leads with a question-style headline ("Als jou iets overkomt, weten je dierbaren dan wat belangrijk is?"), a McAfee-style 3-tier pricing section (Basis / Compleet / Premium), and a FAQ accordion, in addition to the photo hero and checklist.

1. Landing page (hero, pricing, an "Overlijden melden" section for trusted contacts, and an FAQ accordion that spells out exactly what happens, how, and when: a single fixed flow for everyone — a trusted contact with the "Helpen bevestigen" role can report a death at any time, which starts a 30-day cancellable waiting period before any information is released)
2. Create an account (name + email only — no password, no email sent)
3. Fill in "Mijn gegevens" (name, address, birth date, phone) — required before you can add assets, and counted in the dashboard completion %
4. Add 3 assets using the one-click type tiles (Bank Account, Crypto, Safe, etc.)
5. Add 2 trusted contacts, including the relationship quick-chips and the two roles ("Ontvangt informatie" / "Helpen bevestigen") — there is no per-contact trigger setting anymore, the notification flow is fixed and identical for every contact. Saving a contact shows a preview modal of the "you've been added as a trusted contact" email that contact would receive
6. Write instructions
7. Generate and download the Legacy Report PDF (one click)
8. Log out, then scroll to "Overlijden melden" on the landing page and submit the form using the same email address you signed up with, plus a reporter name/email — this actually looks up that signup by email and starts a real 30-day waiting period for it, shown in a result panel with a "(demo)" button to fast-forward the wait
9. "Beheer" in the nav shows every signup made in this browser (account, personal info, assets, contacts, instructions, report status, and — once reported — who reported it) — a simulated admin view, still entirely local

The dashboard's completion percentage updates live as you go. "Uitloggen" (top right once signed in) signs you out and returns you to the landing page — your saved plan stays intact in local storage. Each new signup starts with a fresh, empty workspace, so multiple test accounts in the same browser don't share data in "Beheer".

## What's real vs. what's mocked

Real and working:
- The full click-through flow and all 6 pages from the brief
- Local data persistence (survives a page refresh, tied to this browser)
- Actual PDF generation (jsPDF), formatted for printing/sharing
- The "Overlijden melden" form on the landing page is functionally wired: it looks up the deceased's e-mail address in the locally stored signups (the same data "Beheer" reads) and, on a match, actually starts that account's 30-day waiting period — visible in "Beheer" and on that account's own dashboard if you log back in as it

Intentionally mocked / not built (per the brief's "Future Features — do not build yet," plus this needs a real backend):
- Account creation, email verification, and sessions are simulated only — nothing is transmitted or stored outside your browser
- No real e-mail is ever sent. The contact-invite preview (shown after saving a trusted contact) and the death-report flow itself are demonstrated entirely through this browser's local storage — there's no mail server, and "Overlijden melden" only works against signups that exist in this same browser
- The 30-day waiting period describes the intended product behavior; nothing is actually scheduled against real time — the "(demo)" button exists purely to fast-forward it for testing
- The pricing/package cards on the landing page are a visual mock — every plan's CTA routes to the same demo signup flow; there is no real checkout, billing, or payment processing
- The "Aanmelden"/"Nu abonneren" buttons lead to a McAfee-style checkout screen (e-mail step, collapsible payment step, order summary with plan switcher) — this is a visual mock only. No card data is collected, no payment brand logos are reproduced (plain text badges instead), and clicking "Doorgaan" just creates the local demo account
- Encryption, audit logging, and GDPR-grade infrastructure (these are backend/server concerns that a static prototype can't demonstrate)

## Design notes

Calm, confident enterprise-grade palette (deep blue/near-black/white/gray), Inter typeface, hand-drawn line-icon system (no emoji), generous whitespace, no jargon — modeled after the Stripe/Linear/Mercury references in the brief. Trust messaging ("we never store passwords, private keys, or recovery phrases," "you stay in control") is repeated across the landing page, assets page, dashboard, and the report itself.

## Files

- `index.html` — entry point
- `styles.css` — design system
- `app.js` — all app logic (state, routing, forms, PDF generation)
