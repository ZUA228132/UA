export function aHashFromImageData(img: ImageData): string {
  // 8x8 grayscale average hash, hex string 16 chars
  const w = 8, h = 8
  const tmp = new OffscreenCanvas(w, h)
  const tctx: any = (tmp as any).getContext('2d')
  tctx.drawImage(img as any, 0, 0, w, h) // not actually used here; kept for reference
  // Fallback: compute from ImageData directly
  let sum = 0
  const g: number[] = []
  for (let i = 0; i < img.data.length; i += 4) {
    const gray = 0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2]
    g.push(gray)
    sum += gray
  }
  const avg = sum / g.length
  let bits = ''
  for (const v of g) bits += v > avg ? '1' : '0'
  return BigInt('0b' + bits).toString(16).padStart(16, '0')
}

export function hammingHex64(a: string, b: string): number {
  const x = (BigInt('0x'+a) ^ BigInt('0x'+b)).toString(2)
  let cnt = 0
  for (let i=0;i<x.length;i++) if (x[i]==='1') cnt++
  return cnt
}

export function l2(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i=0;i<n;i++){ const d=a[i]-b[i]; s+=d*d }
  return Math.sqrt(s)
}

export type MatchScore = {
  id: number
  image_url: string
  tg_user_id: number | null
  dist: number
  ahash?: string
}

export function topKByAhash(query: string, rows: any[], k = 5) {
  const scored = rows.map(r => ({
    id: r.id,
    image_url: r.image_url,
    tg_user_id: r.tg_user_id,
    ahash: r.ahash,
    dist: hammingHex64(query, r.ahash || '0')
  }))
  scored.sort((a,b)=>a.dist-b.dist)
  return scored.slice(0, k)
}

export function topKByDescriptor(q: number[], rows: any[], k = 5) {
  const scored = rows.map(r => ({
    id: r.id,
    image_url: r.image_url,
    tg_user_id: r.tg_user_id,
    dist: Array.isArray(r.descriptor) ? l2(q, r.descriptor as number[]) : 1e9
  }))
  scored.sort((a,b)=>a.dist-b.dist)
  return scored.slice(0, k)
}
