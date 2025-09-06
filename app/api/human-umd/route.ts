export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const CANDIDATES = [
  'https://unpkg.com/@vladmandic/human/dist/human.js',
  'https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js',
  'https://unpkg.com/@vladmandic/human/dist/human.min.js',
  'https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.min.js',
]

export async function GET() {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { cache: 'no-store', redirect: 'follow' })
      if (res.ok) {
        const js = await res.text()
        return new NextResponse(js, {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch {}
  }
  return NextResponse.json({ error: 'Failed to fetch Human UMD' }, { status: 502 })
}
