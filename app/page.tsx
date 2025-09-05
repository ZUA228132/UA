'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    // unknown shapes exported by different UMD builds
    human?: any
    Human?: any
    humanjs?: any
    [key: string]: any
  }
}

const HUMAN_SCRIPT_ID = 'human-umd-script'
const HUMAN_UMD_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.5/dist/human.js' // pinned

function injectScriptOnce(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      if ((existing as any)._loaded) return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('script error: ' + src)))
      return
    }
    const s = document.createElement('script')
    s.id = id
    s.src = src
    s.async = true
    s.onload = () => { (s as any)._loaded = true; resolve() }
    s.onerror = () => reject(new Error('script error: ' + src))
    document.head.appendChild(s)
  })
}

function findHumanGlobal():
  | { mode: 'singleton', human: any }
  | { mode: 'constructor', Ctor: any }
  | null
{
  // 1) direct known names
  if (window.human && typeof window.human.load === 'function' && typeof window.human.detect === 'function') {
    return { mode: 'singleton', human: window.human }
  }
  if (typeof window.Human === 'function') {
    return { mode: 'constructor', Ctor: window.Human }
  }
  if (window.humanjs && typeof window.humanjs.load === 'function') {
    return { mode: 'singleton', human: window.humanjs }
  }
  // 2) heuristic: scan window for an object with methods load+detect
  for (const key of Object.keys(window)) {
    try {
      const v = (window as any)[key]
      if (v && typeof v === 'object' && typeof v.load === 'function' && typeof v.detect === 'function') {
        return { mode: 'singleton', human: v }
      }
      if (typeof v === 'function' && /Human/i.test(key) && 'prototype' in v) {
        return { mode: 'constructor', Ctor: v }
      }
    } catch {}
  }
  return null
}

export default function Page(){
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try {
        // IMPORTANT: ensure layout.tsx does NOT include any Human script tags to avoid double-loads
        await Promise.race([
          injectScriptOnce(HUMAN_UMD_URL, HUMAN_SCRIPT_ID),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout loading script')), 8000)),
        ])

        // Give the UMD a microtick to attach globals
        await new Promise(r => setTimeout(r, 50))

        const resolved = findHumanGlobal()
        if (!resolved) throw new Error('Human global not found after loading')

        let human: any
        if (resolved.mode === 'constructor') {
          const Ctor = resolved.Ctor
          human = new Ctor({
            modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
            face: { enabled: true, detector: { rotation: true, rotate: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true } },
          })
        } else {
          human = resolved.human
          // set base path if property exists
          try { if (!human.config) human.config = {}; human.config.modelBasePath = 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models' } catch {}
        }

        await human.load()
        await human.warmup()

        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,c.width,c.height)
        const res = await human.detect(c)
        if (alive) setStatus(`Human ready${human.version ? ' v'+human.version : ''}. Faces: ${res.face?.length ?? 0}`)
      } catch (e: any) {
        if (alive) setStatus('Human load error: ' + (e?.message || String(e)))
      }
    })()

    return () => { alive = false }
  }, [])

  return (
    <main style={{padding:20}}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={64} height={64} style={{display:'none'}} />
    </main>
  )
}
