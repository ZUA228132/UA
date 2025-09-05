'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
  }
}

export default function Page() {
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true

    async function init() {
      // ждём, пока UMD-скрипт из layout повесит глобалы
      const start = Date.now()
      while (!window.human && !window.Human) {
        if (Date.now() - start > 10000) {
          setStatus('Human load error: Human UMD not loaded')
          return
        }
        await new Promise(r => setTimeout(r, 150))
      }

      // 1) singleton?
      let human: any
      if (window.human && typeof window.human.load === 'function') {
        human = window.human
      }
      // 2) constructor?
      else if (typeof window.Human === 'function') {
        human = new (window as any).Human({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
          face: { enabled: true, detector: { rotation: true, rotate: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true } },
        })
      }
      // 3) namespace с конструктором внутри?
      else if ((window as any).Human?.Human && typeof (window as any).Human.Human === 'function') {
        const Ctor = (window as any).Human.Human
        human = new Ctor({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
          face: { enabled: true, detector: { rotation: true, rotate: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true } },
        })
      } else {
        setStatus('Human load error: unsupported UMD shape')
        return
      }

      try {
        await human.load()
        await human.warmup()

        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,c.width,c.height)
        const res = await human.detect(c)

        if (alive) setStatus(`Human ready${human.version ? ' v' + human.version : ''}. Faces: ${res.face?.length ?? 0}`)
      } catch (e: any) {
        if (alive) setStatus('Human load error: ' + (e?.message || String(e)))
      }
    }

    init()
    return () => { alive = false }
  }, [])

  return (
    <main style={{ padding: 20 }}>
      <h1>Human via CDN (UMD)</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={64} height={64} style={{ display: 'none' }} />
    </main>
  )
}
