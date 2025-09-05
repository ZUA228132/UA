// Proxy Human UMD to avoid any cross-origin/CORP hiccups
export const runtime = 'nodejs'

export async function GET() {
  const url = 'https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js'
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    return new Response('// failed to fetch human.js', { status: 502 })
  }
  const js = await res.text()
  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
