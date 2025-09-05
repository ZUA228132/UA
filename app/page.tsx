'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
    Telegram?: any
  }
}

type Step = 'intro' | 'scanning' | 'result'
type TgInfo = { name: string; id: number | null; startParam: string }

function parseMode(startParam: string) {
  const parts = String(startParam || '').split('_')
  const mode = parts[1] === 'verification' ? 'verification' : 'identification'
  const faceId = parts[2] ? Number(parts[2]) : undefined
  return { mode, faceId }
}

export default function Page() {
  const [tg, setTg] = useState<TgInfo>({ name: 'Користувач', id: null, startParam: '' })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const unsafe = (window as any).Telegram?.WebApp?.initDataUnsafe
    const user = unsafe?.user
    setTg({
      name: user?.first_name || user?.username || 'Користувач',
      id: user?.id ?? null,
      startParam: unsafe?.start_param || '',
    })
  }, [])
  const { mode, faceId } = parseMode(tg.startParam)

  const [step, setStep] = useState<Step>('intro')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [faces, setFaces] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const snapRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  const minGoodFrames = 48
  const [goodFrames, setGoodFrames] = useState(0)

  const humanCfg: any = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    warmup: 'face',
    face: { enabled: true, detector: { rotation: true, rotate: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true } }
  }

  function aHashFromCanvas(canvas: HTMLCanvasElement): string {
    const w = 8, h = 8
    const t = document.createElement('canvas')
    t.width = w; t.height = h
    const tctx = t.getContext('2d')!
    tctx.drawImage(canvas, 0, 0, w, h)
    const { data } = tctx.getImageData(0, 0, w, h)
    let sum = 0; const g: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      g.push(v); sum += v
    }
    const avg = sum / g.length
    let bits = ''; for (const v of g) bits += v > avg ? '1' : '0'
    return BigInt('0b' + bits).toString(16).padStart(16, '0')
  }

  async function ensureHuman() {
    const startT = Date.now()
    while (!(window.human || window.Human)) {
      if (Date.now() - startT > 10000) throw new Error('Human UMD не завантажився')
      await new Promise((r) => setTimeout(r, 100))
    }
    let human: any
    if (window.human?.load) {
      human = window.human
      try { Object.assign(human.config ?? (human.config = {}), humanCfg) } catch {}
    } else if (typeof window.Human === 'function') human = new (window as any).Human(humanCfg)
    else throw new Error('Непідтримуваний формат UMD')
    await human.load(); await human.warmup()
    return human
  }

  async function onStartVerification() {
    if (busy) return
    if (!consent) { setStatus('Поставте позначку згоди'); return }
    if (mode !== 'verification' || !faceId) { setStatus('Відсутній параметр faceId у диплінку'); return }

    setBusy(true)
    try {
      setStatus('Ініціалізація…')
      const human = await ensureHuman()

      setStatus('Запит доступу до камери…')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      const v = videoRef.current!
      v.srcObject = stream; await v.play()

      const w = v.videoWidth || 720, h = v.videoHeight || 720
      const snap = snapRef.current!
      snap.width = w; snap.height = h

      setGoodFrames(0)
      setStep('scanning')
      setStatus('Тримайте обличчя в колі')

      let best: any = null

      const loop = async () => {
        if (step !== 'scanning') return
        const res = await human.detect(v, humanCfg)
        setFaces(res?.face?.length || 0)

        let ok = false
        if (res.face?.length === 1 && res.face[0].descriptor?.length) {
          const f = res.face[0]
          const area = f.box[2] * f.box[3]
          const centered = Math.abs(f.box[0] + f.box[2] / 2 - w / 2) < w * 0.1
          ok = centered && area > (w * h) / 14
          if (ok && (!best || area > best.area)) best = { res: f, area }
        }

        setGoodFrames((g) => {
          const next = ok ? Math.min(minGoodFrames, g + 1) : Math.max(0, g - 2)
          ringRef.current?.style.setProperty('--progress', String(next / minGoodFrames))
          return next
        })

        if (best && goodFrames >= minGoodFrames) {
          const snapCtx = snap.getContext('2d')!
          snapCtx.drawImage(v, 0, 0, w, h)
          const dataUrl = snap.toDataURL('image/jpeg', 0.92)
          const ahash = aHashFromCanvas(snap)
          const descriptor = Array.from(best.res.descriptor as number[])
          ;(v.srcObject as MediaStream).getTracks().forEach((t) => t.stop())

          setStatus('Перевірка…')
          const r = await fetch('/api/verify-mode', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ face_id: faceId, dataUrl, ahash, descriptor, tg_user_id: tg.id, display_name: tg.name })
          })
          const json = await r.json()
          setResult(r.ok ? { ok: true, passed: json.passed, dist: json.dist } : { ok: false, msg: json.error })
          setStep('result')
          setBusy(false)
          return
        }
        setTimeout(loop, 80)
      }
      loop()
    } catch (e: any) {
      setBusy(false)
      setStatus(e?.message || 'Помилка доступу до камери')
    }
  }

  const wrap: React.CSSProperties = { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#000', color: '#fff', padding: 16 }

  return (
    <div style={wrap}>
      {step === 'intro' && (
        <section className="card">
          <h1>Верифікація</h1>
          <p>Вітаємо, <b>{tg.name}</b></p>
          <label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Даю згоду</label>
          <button onClick={onStartVerification} disabled={busy || !consent}>Пройти верифікацію</button>
          <div>{status}</div>
        </section>
      )}
      {step === 'scanning' && (
        <section className="card">
          <h2>Тримайте обличчя в колі</h2>
          <div>Облич у кадрі: {faces}</div>
          <div className="faceid-box">
            <video ref={videoRef} className="faceid-video" autoPlay playsInline muted />
            <div className="faceid-mask"></div>
            <div ref={ringRef} className="faceid-ring" />
            <div className="faceid-edge" />
            <div className="faceid-cross" />
          </div>
          <canvas ref={snapRef} style={{ display: 'none' }} />
          <div>{status}</div>
        </section>
      )}
      {step === 'result' && (
        <section className="card">
          <h2>Результат</h2>
          {result?.ok ? (result.passed ? '✅ Пройдено' : '❌ Не пройдено') : 'Помилка'}
        </section>
      )}
    </div>
  )
}
