'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
    Telegram?: { WebApp: { initDataUnsafe?: any } }
  }
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [step, setStep] = useState<'welcome' | 'camera'>('welcome')
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState('')
  const [faces, setFaces] = useState(0)

  const user = window?.Telegram?.WebApp?.initDataUnsafe?.user
  const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Гость'

  const humanConfig = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    cacheSensitivity: 0,
    warmup: 'face',
    face: { enabled: true, detector: { rotation: true, maxDetected: 1 }, mesh: { enabled: true } }
  } as any

  async function startVerification() {
    if (!agree) {
      alert('Необходимо согласиться на обработку данных')
      return
    }
    setStep('camera')

    // ждём загрузку Human
    let human: any = null
    const start = Date.now()
    while (!(window.human || window.Human)) {
      if (Date.now() - start > 10000) throw new Error('Human UMD not loaded')
      await new Promise(r => setTimeout(r, 100))
    }
    if (window.human && typeof window.human.load === 'function') {
      human = window.human
      Object.assign(human.config ?? (human.config = {}), humanConfig)
    } else if (typeof window.Human === 'function') {
      human = new (window as any).Human(humanConfig)
    }
    await human.load()
    await human.warmup()

    // камера
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }

    // цикл детекции
    const loop = async () => {
      if (videoRef.current) {
        const res = await human.detect(videoRef.current, humanConfig)
        setFaces(res.face.length)
        drawOverlay(res)
      }
      requestAnimationFrame(loop)
    }
    loop()
  }

  function drawOverlay(res: any) {
    const o = overlayRef.current!
    const ctx = o.getContext('2d')!
    ctx.clearRect(0, 0, o.width, o.height)
    o.width = videoRef.current?.videoWidth || 640
    o.height = videoRef.current?.videoHeight || 480

    // затемнение вокруг круга (FaceID-style)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, o.width, o.height)
    const cx = o.width / 2, cy = o.height / 2
    const r = Math.min(o.width, o.height) * 0.35
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // круг рамки
    ctx.lineWidth = 4
    ctx.strokeStyle = faces > 0 ? '#10b981' : '#9ca3af'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      background: step === 'welcome' ? '#f9fafb' : '#000',
      color: step === 'welcome' ? '#111' : '#fff',
      transition: 'all 0.4s ease'
    }}>
      {step === 'welcome' && (
        <div style={{
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          padding: 24,
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>Привет, {userName} 👋</h1>
          <p style={{ fontSize: '1rem', color: '#4b5563', marginBottom: 20 }}>
            Для продолжения нужно пройти FaceID-верификацию
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>Согласен на обработку персональных данных</span>
          </label>
          <button
            onClick={startVerification}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: agree ? '#10b981' : '#9ca3af',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: agree ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            🚀 Пройти верификацию
          </button>
        </div>
      )}

      {step === 'camera' && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 20 }} />
          <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: '1rem', color: '#9ca3af' }}>
            {faces > 0 ? '✅ Лицо распознано' : 'Поместите лицо в рамку'}
          </p>
        </div>
      )}
    </main>
  )
}
