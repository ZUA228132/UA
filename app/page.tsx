'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    Human?: any      // maybe constructor, maybe plain object
    human?: any      // singleton
  }
}

async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const same = Array.from(document.scripts).find(s => s.src === src)
    if (same) { if ((same as any).loaded) return resolve(); same.addEventListener('load', () => resolve()); return }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => { (s as any).loaded = true; resolve() }
    s.onerror = () => reject(new Error('failed to load ' + src))
    document.head.appendChild(s)
  })
}

function detectMode(): 'constructor' | 'singleton' | null {
  if (typeof window.Human === 'function') return 'constructor'
  if (window.human && typeof window.human === 'object' && typeof window.human.load === 'function') return 'singleton'
  return null
}

async function ensureHumanAvailable(): Promise<'constructor'|'singleton'> {
  const first = detectMode()
  if (first) return first

  // try our domain first
  await loadScript('/api/human').catch(()=>{})
  const second = detectMode()
  if (second) return second

  // then try jsDelivr
  await loadScript('https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js').catch(()=>{})
  const third = detectMode()
  if (third) return third

  throw new Error('Human global not found after loading')
}

export default function Page(){
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try {
        const mode = await Promise.race([
          ensureHumanAvailable(),
          new Promise<'constructor'|'singleton'>((_, reject) => setTimeout(() => reject(new Error('timeout waiting for human script')), 10000)),
        ])

        if (!alive) return

        let human: any
        if (mode === 'constructor') {
          const HumanCtor = window.Human!
          human = new HumanCtor({
            modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
            face: { enabled: true, detector: { rotation: true, rotate: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true } },
          })
        } else {
          human = window.human!
        }

        await human.load()
        await human.warmup()

        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,c.width,c.height)
        const res = await human.detect(c)

        if (alive) setStatus(`Human ready${human.version ? ' v'+human.version : ''}. Faces: ${res.face?.length ?? 0}`)
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
