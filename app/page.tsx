'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
  }
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('Initializing…')
  const [faces, setFaces] = useState(0)
  const [fps, setFps] = useState(0)
  const [busySnap, setBusySnap] = useState(false)

  // параметры Human (синглтон или инстанс — оба поддержим)
  const humanConfig = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    // ускоряем, чтобы в WebView шло гладко
    cacheSensitivity: 0,
    warmup: 'face',
    face: {
      enabled: true,
      detector: { rotation: true, rotate: true, maxDetected: 1 },
      mesh: { enabled: true },
      attention: { enabled: false },
      emotion: { enabled: false },
      iris: { enabled: false },
      description: { enabled: true } // пригодится позже для векторов
    }
  } as any

  useEffect(() => {
    let stop = false
    let raf = 0
    let human: any = null

    // средний FPS
    let last = performance.now()
    let frames = 0

    async function ensureHuman() {
      // ждём глобал, который уже грузится из layout.tsx
      const start = Date.now()
      while (!(window.human || window.Human)) {
        if (Date.now() - start > 10000) throw new Error('Human UMD not loaded')
        await new Promise(r => setTimeout(r, 100))
      }
      // синглтон?
      if (window.human && typeof window.human.load === 'function') {
        human = window.human
        // установим конфиг (если свойство есть)
        try { Object.assign(human.config ?? (human.config = {}), humanConfig) } catch {}
      } else if (typeof window.Human === 'function') {
        // конструктор
        human = new (window as any).Human(humanConfig)
      } else {
        throw new Error('Unsupported Human UMD shape')
      }
      await human.load()
      await human.warmup()
      setStatus('Human ready')
      console.log('Human: version:', human.version)
    }

    async function initCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      })
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()
      // синхронизируем канвасы с видео
      const w = v.videoWidth || 640
      const h = v.videoHeight || 640
      const c = canvasRef.current!, o = overlayRef.current!
      c.width = o.width = w
      c.height = o.height = h
    }

    function drawOverlay(res: any) {
      const o = overlayRef.current!
      const ctx = o.getContext('2d')!
      ctx.clearRect(0, 0, o.width, o.height)

      // рамка «Face ID»
      const cx = o.width / 2, cy = o.height / 2
      const r = Math.min(o.width, o.height) * 0.35
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0, 200, 120, 0.9)'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      // отрисовка найденных лиц
      if (res?.face?.length) {
        const f = res.face[0]
        // bbox
        const { box } = f
        ctx.strokeStyle = 'rgba(80, 220, 60, 0.9)'
        ctx.lineWidth = 2
        ctx.strokeRect(box[0], box[1], box[2], box[3])
        // mesh точки (порежем, чтобы не грузить)
        if (f.mesh) {
          ctx.fillStyle = 'rgba(80, 220, 60, 0.9)'
          for (let i = 0; i < f.mesh.length; i += 8) {
            const [x, y] = f.mesh[i]
            ctx.beginPath()
            ctx.arc(x, y, 1.1, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    async function loop() {
      if (stop) return
      const v = videoRef.current!
      if (v.readyState >= 2) {
        // Human допускает HTMLVideoElement
        const res = await human.detect(v, humanConfig)
        setFaces(res?.face?.length || 0)
        drawOverlay(res)
        // FPS
        frames++
        const now = performance.now()
        if (now - last >= 1000) {
          setFps(frames)
          frames = 0
          last = now
        }
      }
      // не чаще ~120мс
      await new Promise(r => setTimeout(r, 120))
      raf = requestAnimationFrame(loop)
    }

    ;(async () => {
      try {
        await ensureHuman()
        await initCamera()
        setStatus('Scanning…')
        loop()
      } catch (e: any) {
        setStatus('Error: ' + (e?.message || String(e)))
      }
    })()

    return () => {
      stop = true
      cancelAnimationFrame(raf)
      const s = (videoRef.current?.srcObject as MediaStream | undefined)
      s?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function snapshot() {
    if (busySnap) return
    setBusySnap(true)
    try {
      const v = videoRef.current!, c = canvasRef.current!
      const ctx = c.getContext('2d')!
      ctx.drawImage(v, 0, 0, c.width, c.height)
      const dataUrl = c.toDataURL('image/jpeg', 0.92)
      // TODO: отправь это в свой API (Vercel Blob + Neon)
      // await fetch('/api/enroll', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ dataUrl }) })
      console.log('snapshot len=', dataUrl.length)
      alert('Снимок готов (см. консоль)')
    } finally {
      setBusySnap(false)
    }
  }

  return (
    <main style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>Human via CDN (UMD)</h1>
      <p style={{ marginTop: 4 }}>{status} — Faces: {faces} — FPS: {fps}</p>

      <div style={{ position: 'relative', width: 'min(92vw, 640px)' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 16, background: '#000' }} />
        <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>

      <button
        onClick={snapshot}
        disabled={busySnap}
        style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 600 }}
      >
        {busySnap ? 'Сохраняю…' : 'Сделать снимок'}
      </button>

      {/* скрытый канвас для снапшота */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </main>
  )
}
