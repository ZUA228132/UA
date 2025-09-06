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

// Режим по умолчанию — verification
function parseMode(startParam: string) {
  const parts = String(startParam || '').split('_')
  const parsed =
    parts[1] === 'verification'
      ? 'verification'
      : parts[1] === 'identification'
      ? 'identification'
      : 'verification'
  return { mode: parsed }
}

export default function Page() {
  // Telegram info с fallback
  const [tg, setTg] = useState<TgInfo>({ name: 'Користувач', id: null, startParam: '' })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const unsafe = (window as any).Telegram?.WebApp?.initDataUnsafe
    const user = unsafe?.user

    let id: number | null = user?.id ?? null
    let name: string = user?.first_name || user?.username || 'Користувач'

    const qId = q.get('tg_id')
    const qName = q.get('name')
    if (!id && qId) id = Number(qId)
    if (qName) name = qName

    if (!id) {
      id = Number(String(Date.now()).slice(-9)) // демо-ID
      name = `${name} (демо)`
    }

    setTg({
      name,
      id,
      startParam: unsafe?.start_param || q.get('start') || '',
    })
  }, [])
  const { mode } = parseMode(tg.startParam)

  const [step, setStep] = useState<Step>('intro')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [faces, setFaces] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; passed?: boolean; dist?: number; msg?: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const snapRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  const minGoodFrames = 48
  const [goodFrames, setGoodFrames] = useState(0)

  const humanCfg: any = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    warmup: 'face',
    face: {
      enabled: true,
      detector: { rotation: true, rotate: true, maxDetected: 1 },
      mesh: { enabled: true },
      description: { enabled: true },
      iris: { enabled: false },
      emotion: { enabled: false },
      attention: { enabled: false },
    },
  }

  // Надёжная загрузка Human
  async function ensureHuman() {
    if (window.human?.load) {
      const h: any = window.human
      Object.assign(h.config ?? (h.config = {}), humanCfg)
      await h.load()
      await h.warmup()
      return h
    }
    if (typeof window.Human === 'function') {
      const h: any = new (window as any).Human(humanCfg)
      await h.load()
      await h.warmup()
      return h
    }
    await new Promise<void>((resolve, reject) => {
      const id = 'human-umd'
      if (document.getElementById(id)) return resolve()
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js'
      s.async = true
      s.crossOrigin = 'anonymous'
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Не вдалося завантажити Human UMD'))
      document.head.appendChild(s)
    })
    if (window.human?.load) {
      const h: any = window.human
      Object.assign(h.config ?? (h.config = {}), humanCfg)
      await h.load()
      await h.warmup()
      return h
    }
    if (typeof window.Human === 'function') {
      const h: any = new (window as any).Human(humanCfg)
      await h.load()
      await h.warmup()
      return h
    }
    throw new Error('Human UMD недоступний після завантаження')
  }

  function aHashFromCanvas(canvas: HTMLCanvasElement): string {
    const w = 8,
      h = 8
    const t = document.createElement('canvas')
    t.width = w
    t.height = h
    const tctx = t.getContext('2d')!
    tctx.drawImage(canvas, 0, 0, w, h)
    const { data } = tctx.getImageData(0, 0, w, h)
    let sum = 0
    const g: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      g.push(v)
      sum += v
    }
    const avg = sum / g.length
    let bits = ''
    for (const v of g) bits += v > avg ? '1' : '0'
    return BigInt('0b' + bits).toString(16).padStart(16, '0')
  }

  async function onStartVerification() {
    if (busy) return
    if (!consent) {
      setStatus('Поставте позначку згоди')
      return
    }
    setBusy(true)
    try {
      setStatus('Ініціалізація…')
      const human = await ensureHuman()

      setStatus('Запит доступу до камери…')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()

      const w = v.videoWidth || 720,
        h = v.videoHeight || 720
      const snap = snapRef.current!
      snap.width = w
      snap.height = h

      setGoodFrames(0)
      setStep('scanning')
      setStatus('Повільно повертайте голову та тримайте обличчя в колі')

      let best: any = null

      const loop = async () => {
        if (step !== 'scanning') return
        const res = await human.detect(v, humanCfg)
        setFaces(res?.face?.length || 0)

        let ok = false
        if (res.face?.length === 1 && res.face[0].descriptor?.length) {
          const f = res.face[0]
          const area = f.box[2] * f.box[3]
          const center = Math.hypot(f.box[0] + f.box[2] / 2 - w / 2, f.box[1] + f.box[3] / 2 - h / 2)
          const centered = center < Math.min(w, h) * 0.1
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              face_id: tg.id,
              dataUrl,
              ahash,
              descriptor,
              tg_user_id: tg.id,
              display_name: tg.name,
              demo: String(tg.name).includes('(демо)') ? true : undefined,
            }),
          })
          const json = await r.json()
          if (!r.ok) setResult({ ok: false, msg: json.error || r.statusText })
          else setResult({ ok: true, passed: json.passed, dist: json.dist })
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

  // ——— UI ———
  const wrap: React.CSSProperties = {
    minHeight: '100dvh',
    padding:
      'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
    display: 'grid',
    placeItems: 'center',
    background: '#000',
    color: '#fff',
  }
  const card: React.CSSProperties = {
    width: 'min(96vw, 520px)',
    background: '#111',
    borderRadius: 20,
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    padding: 18,
    border: '1px solid rgba(255,255,255,0.06)',
  }
  const btn: React.CSSProperties = {
    width: '100%',
    marginTop: 14,
    padding: '16px',
    borderRadius: 14,
    border: 'none',
    background: '#0a84ff',
    color: '#fff',
    fontWeight: 700,
    fontSize: 'clamp(15px, 3.6vw, 16px)',
    cursor: 'pointer',
  }
  const small: React.CSSProperties = { fontSize: 'clamp(11px, 2.8vw, 12px)', opacity: 0.7, marginTop: 10 }

  return (
    <div style={wrap}>
      {step === 'intro' && (
        <section style={card}>
          <h1 style={{ fontSize: 'clamp(20px, 5.2vw, 26px)', fontWeight: 700, margin: 0 }}>Верифікація</h1>
          <div style={{ marginTop: 8, opacity: 0.9 }}>
            Вітаємо, <b>{tg.name}</b>
          </div>

          <div
            style={{
              marginTop: 12,
              background: '#0b0b0b',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14,
              padding: 14,
              lineHeight: 1.5,
              fontSize: 'clamp(13px, 3.6vw, 14px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Що відбудеться:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Запросимо доступ до камери</li>
              <li>Покажемо коло Face ID та автоматично зробимо знімок</li>
              <li>Порівняємо з еталоном і надішлемо результат</li>
            </ul>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>Даю згоду на обробку зображення обличчя для верифікації</span>
          </label>

          <button onClick={onStartVerification} disabled={busy || !consent} style={{ ...btn, opacity: busy || !consent ? 0.6 : 1 }}>
            Пройти верифікацію
          </button>

          {status && <div style={small}>{status}</div>}
        </section>
      )}

      {step === 'scanning' && (
        <section style={{ ...card, width: 'min(98vw, 720px)' }}>
          <h2 style={{ fontSize: 'clamp(16px, 4.6vw, 20px)', fontWeight: 600, margin: 0 }}>Тримайте обличчя в колі</h2>
          <div style={{ fontSize: 'clamp(11px, 2.8vw, 12px)', opacity: 0.7, marginTop: 6 }}>Облич у кадрі: {faces}</div>

          <div className="faceid-box" style={{ marginTop: 10 }}>
            <video ref={videoRef} className="faceid-video" autoPlay playsInline muted />
            <div className="faceid-mask"></div>
            <div ref={ringRef} className="faceid-ring" />
          </div>

          <div style={small}>{status}</div>
          <canvas ref={snapRef} style={{ display: 'none' }} />
        </section>
      )}

      {step === 'result' && (
        <section style={card}>
          <h2 style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700, margin: 0 }}>Результат</h2>
          {result?.ok ? (
            <div style={{ marginTop: 10, fontSize: 'clamp(15px, 4vw, 18px)' }}>
              {result.passed ? '✅ Верифікацію пройдено' : '❌ Верифікацію не пройдено'}
              {'dist' in (result || {}) && (
                <div style={{ fontSize: 'clamp(11px, 2.8vw, 12px)', opacity: 0.7, marginTop: 6 }}>
                  dist: {result?.dist?.toFixed?.(3)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#ff4d4f', marginTop: 10 }}>{'Помилка: ' + (result?.msg || 'Невідома помилка')}</div>
          )}
          <button
            onClick={() => {
              setStep('intro')
              setResult(null)
              setStatus('')
              setConsent(false)
            }}
            style={{ ...btn, background: '#34c759' }}
          >
            Готово
          </button>
        </section>
      )}
    </div>
  )
}
