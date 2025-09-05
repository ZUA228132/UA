'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
    humanjs?: any
  }
}

const HUMAN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.5/dist/human.js'

export default function Page() {
  const [status, setStatus] = useState('Loading...')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // грузим один раз
        await new Promise<void>((resolve, reject) => {
          if (document.getElementById('human-umd')) return resolve()
          const s = document.createElement('script')
          s.id = 'human-umd'
          s.src = HUMAN_URL
          s.async = true
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('failed to load Human UMD'))
          document.head.appendChild(s)
        })

        // ждём пока Human повесит global
        await new Promise(r => setTimeout(r, 200))

        const human = window.human || window.humanjs || window.Human
        if (!human) throw new Error('Human UMD global not found')

        await human.load()
        await human.warmup()

        const c = canvasRef.current!
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, c.width, c.height)
        const res = await human.detect(c)

        if (alive) setStatus(`Human ready v${human.version || ''}. Faces: ${res.face?.length ?? 0}`)
      } catch (e: any) {
        if (alive) setStatus('Human load error: ' + (e?.message || String(e)))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <main style={{ padding: 20 }}>
      <h1>Human via CDN</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={64} height={64} style={{ display: 'none' }} />
    </main>
  )
}
