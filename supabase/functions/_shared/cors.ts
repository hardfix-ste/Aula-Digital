// Cabeceras CORS compartidas por todas las Edge Functions.
// ALLOWED_ORIGIN: en producción configurá el origen de GitHub Pages
// (ej. https://TU-USUARIO.github.io) con: supabase secrets set ALLOWED_ORIGIN=...
export function corsHeaders(req: Request) {
  const allowed = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = allowed === '*' || origin === allowed ? (allowed === '*' ? '*' : origin) : allowed
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
