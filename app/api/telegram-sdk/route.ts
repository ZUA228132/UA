// Proxy Telegram WebApp SDK to avoid CORP issues and 404
export const runtime = 'nodejs'

export async function GET() {
  const url = 'https://telegram.org/js/telegram-web-app.js'
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    return new Response('// failed to fetch telegram sdk', { status: 502 })
  }
  const js = await res.text()
  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // allow cross-origin usage
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      // cache on CDN/browsers for a day
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  })
}
