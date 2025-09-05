'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
  }
}

async function loadScriptOnce(src: string, attr: Record<string,string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    // if already present with same src, resolve
    const existing = Array.from(document.scripts).find(s => s.src === src)
    if (existing) { existing.addEventListener('load', () => resolve()); if ((existing as any).loaded) return resolve(); }
    const s = document.createElement('script')
    s.src = src
    Object.entries(attr).forEach(([k,v]) => s.setAttribute(k, v))
    s.async = true
    s.onload = () => { (s as any).loaded = true; resolve() }
    s.onerror = (e) => reject(new Error('failed to load ' + src))
    document.head.appendChild(s)
  })
}

async function ensureHuman(): Promise<void> {
  // try our proxy first
  try { await loadScriptOnce('/api/human'); if (window.human) return } catch {}
  // then try jsDelivr
  try { await loadScriptOnce('https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js'); if (window.human) return } catch {}
  // then fallback to unpkg
  try { await loadScriptOnce('https://unpkg.com/@vladmandic/human/dist/human.js'); if (window.human) return } catch {}
  throw new Error('Human script not found')
}

export default function Page(){
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try {
        // load script with fallbacks + 10s overall timeout
        const timer = setTimeout(()=>{ if (alive) setStatus('Human load error: timeout (script not found)') }, 10000)
        await ensureHuman()
        clearTimeout(timer)
        if (!alive) return
        const human = window.human
        if (!human) throw new Error('Human UMD not loaded after script')
        await human.load()
        await human.warmup()
        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,c.width,c.height)
        const res = await human.detect(c)
        if (alive) setStatus(`Human ready v${human.version}. Faces: ${res.face?.length ?? 0}`)
      } catch (e:any) {
        if (alive) setStatus('Human load error: ' + (e?.message || String(e)))
      }
    })()
    return ()=>{ alive = false }
  }, [])

  return (
    <main style={{padding:20}}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={64} height={64} style={{display:'none'}} />
    </main>
  )
}
