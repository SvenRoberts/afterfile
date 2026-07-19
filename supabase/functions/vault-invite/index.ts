import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const VAULTWARDEN_URL = Deno.env.get('VAULTWARDEN_URL')
const VAULTWARDEN_ADMIN_TOKEN = Deno.env.get('VAULTWARDEN_ADMIN_TOKEN')

// Haal een admin-sessiecookie op van Vaultwarden
async function getAdminCookie(): Promise<string> {
  const res = await fetch(`${VAULTWARDEN_URL}/admin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${encodeURIComponent(VAULTWARDEN_ADMIN_TOKEN!)}`,
    redirect: 'manual',
  })
  const cookie = res.headers.get('set-cookie') || ''
  // Haal alleen het cookie-gedeelte op (voor de eerste puntkomma)
  return cookie.split(';')[0]
}

// Nodig een e-mailadres uit op de Vaultwarden-server
async function inviteToVault(email: string): Promise<{ ok: boolean; status: number }> {
  const cookie = await getAdminCookie()
  const res = await fetch(`${VAULTWARDEN_URL}/admin/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ email }),
  })
  return { ok: res.ok || res.status === 409, status: res.status }
  // 409 = gebruiker bestaat al, dat is prima
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Vaultwarden nog niet geconfigureerd: stille fallback
  if (!VAULTWARDEN_URL || !VAULTWARDEN_ADMIN_TOKEN) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'vault_not_configured' }), { headers: CORS })
  }

  try {
    const { email, account_id, contact_id } = await req.json()
    if (!email) return new Response(JSON.stringify({ error: 'email verplicht' }), { status: 400, headers: CORS })

    const { ok, status } = await inviteToVault(email)

    if (ok) {
      // Sla vault_invited_at op in Supabase
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      if (account_id) {
        await supabase.from('profiles').update({ vault_invited_at: new Date().toISOString() }).eq('id', account_id)
      }
      if (contact_id) {
        await supabase.from('contacts').update({ vault_invited_at: new Date().toISOString() }).eq('id', contact_id)
      }
    }

    return new Response(JSON.stringify({ ok, vaultwarden_status: status }), { headers: CORS })
  } catch (e) {
    console.error('vault-invite fout:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
