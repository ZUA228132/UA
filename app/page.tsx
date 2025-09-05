'use client'
export const dynamic = 'force-dynamic' // не даём Next статически пререндерить страницу

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
  // --- Telegram user: читаем только на клиенте
  const [tg, setTg] = useState<TgInfo>({ name: 'Пользователь', id: null, startParam: '' })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const unsafe = (window as any).Telegram?.WebApp?.initDataUnsafe
    const user = unsafe?.user
    setTg({
      name: user?.first_name || user?.username || 'Пользователь',
      id: user?.id ?? null,
      startParam: unsafe?.start_param || '',
    })
  }, [])
  const { mode, faceId } = parseMode(tg.startParam)

  const [step, setStep] = useState<Step>('intro')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [faces, setFaces] = useState(0)
  const [result, setResult] = useState<{ ok?: boolean; passed?: boolean; dist?: number; msg?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const snapRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // прогресс-захват: сколько «хороших» кадров
  const minGoodFrames = 48 // больше — плавнее анимация
  const [goodFrames, setGoodFrames] = useState(0)

  const humanCfg: any = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    warmup: 'face',
    face: {
      enabled: true,
      detector: { rotation: true, rotate: true, maxDetected: 1 },
      mesh: { enabled: true },
      description: { enabled: true },
      iris: { enabled: false }, emotion: { enabled: false }, attention: { enabled: false },
    },
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

  async function ensureHuman() {
    const startT = Date.now()
    while (!(window.human || window.Human)) {
      if (Date.now() - startT > 10000) throw new Error('Human UMD not loaded')
      await new Promise((r) => setTimeout(r, 100))
    }
    let human: any
    if (window.human?.load) {
      human = window.human
      try {
        Object.assign(human.config ?? (human.config = {}), humanCfg)
      } catch {}
    } else if (typeof window.Human === 'function') human = new (window as any).Human(humanCfg)
    else throw new Error('Unsupported UMD shape')
    await human.load()
    await human.warmup()
    return human
  }

  // Рисуем колечко FaceID с 64 сегментами
  function drawFaceIdRing(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
    const cx = w / 2,
      cy = h / 2
    const radius = Math.min(w, h) * 0.34
    const seg = 64
    const filled = Math.round(progress * seg)

    ctx.save()
    ctx.clearRect(0, 0, w, h)

    // затемнение фона с круглой "дыркой"
    ctx.fillStyle = 'rgba(0,0,0,0.40)'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // сегменты
    const startAngle = -Math.PI / 2
    const fullLen = Math.PI * 2
    for (let i = 0; i < seg; i++) {
      const a0 = startAngle + (fullLen / seg) * i + 0.02
      const a1 = startAngle + (fullLen / seg) * (i + 1) - 0.02
      const r0 = radius * 0.92
      const r1 = radius * 1.06

      ctx.beginPath()
      ctx.strokeStyle = i < filled ? '#34c759' : 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 4
      ctx.arc(cx, cy, (r0 + r1) / 2, a0, a1)
      ctx.stroke()
    }

    // тонкая окружность
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  async function onStartVerification() {
    if (busy) return
    if (!consent) {
      setStatus('Поставьте галочку согласия')
      return
    }
    if (mode !== 'verification' || !faceId) {
      setStatus('Отсутствует параметр faceId (deep-link)')
      return
    }
    setBusy(true)
    try {
      setStatus('Инициализация…')
      const human = await ensureHuman()

      setStatus('Запрос доступа к камере…')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()

      const w = v.videoWidth || 720,
        h = v.videoHeight || 720
      const snap = snapRef.current!,
        ov = overlayRef.current!
      snap.width = ov.width = w
      snap.height = ov.height = h

      setGoodFrames(0)
      setStep('scanning')
      setStatus('Плавно поворачивайте голову и держите лицо в рамке')

      let best: any = null

      const loop = async () => {
        if (step !== 'scanning') return
        const res = await human.detect(v, humanCfg)
        setFaces(res?.face?.length || 0)

        // оценим «качество» кадра
        let ok = false
        if (res.face?.length === 1 && res.face[0].descriptor?.length) {
          const f = res.face[0]
          const area = f.box[2] * f.box[3]
          const center = Math.hypot(f.box[0] + f.box[2] / 2 - w / 2, f.box[1] + f.box[3] / 2 - h / 2)
          const centered = center < Math.min(w, h) * 0.1 // близко к центру
          ok = centered && area > (w * h) / 14 // лицо достаточно крупно
          if (ok && (!best || area > best.area)) best = { res: f, area }
        }

        setGoodFrames((g) => {
          const next = ok ? Math.min(minGoodFrames, g + 1) : Math.max(0, g - 2)
          const ctx = ov.getContext('2d')!
          drawFaceIdRing(ctx, w, h, next / minGoodFrames)
          return next
        })

        if (best && goodFrames >= minGoodFrames) {
          // фиксируем
          const snapCtx = snap.getContext('2d')!
          snapCtx.drawImage(v, 0, 0, w, h)
          const dataUrl = snap.toDataURL('image/jpeg', 0.92)
          const ahash = aHashFromCanvas(snap)
          const descriptor = Array.from(best.res.descriptor as number[])

          ;(v.srcObject as MediaStream).getTracks().forEach((t) => t.stop())

          setStatus('Проверка…')
          const r = await fetch('/api/verify-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              face_id: faceId,
              dataUrl,
              ahash,
              descriptor,
              tg_user_id: tg.id,
              display_name: tg.name,
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
      setStatus(e?.message || 'Ошибка доступа к камере')
    }
  }

  // ————— UI (минималистичный «apple-style») —————
  const wrap: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    background: '#000', // как на скрине
    color: '#fff',
  }
  const card: React.CSSProperties = {
    width: 'min(92vw, 460px)',
    background: '#111',
    borderRadius: 24,
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    padding: 24,
    border: '1px solid rgba(255,255,255,0.05)',
  }
  const btn: React.CSSProperties = {
    width: '100%',
    marginTop: 16,
    padding: '14px 16px',
    borderRadius: 14,
    border: 'none',
    background: '#0a84ff',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
  }
  const small: React.CSSProperties = { fontSize: 12, opacity: 0.65, marginTop: 10 }

  return (
    <div style={wrap}>
      {step === 'intro' && (
        <section style={card}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Верификация</h1>
          <div style={{ marginTop: 8, opacity: 0.9 }}>
            Здравствуйте, <b>{tg.name}</b>
          </div>

          <div
            style={{
              marginTop: 16,
              background: '#0b0b0b',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Что произойдёт:</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              <li>Запросим доступ к камере</li>
              <li>Покажем рамку Face ID и автоматически сделаем снимок</li>
              <li>Сверим с эталоном и отправим результат</li>
            </ul>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>Я согласен(на) на обработку изображения лица для верификации</span>
          </label>

          <button onClick={onStartVerification} disabled={busy} style={{ ...btn, opacity: busy ? 0.7 : 1 }}>
            Пройти верификацию
          </button>

          {status && <div style={small}>{status}</div>}
        </section>
      )}

      {step === 'scanning' && (
        <section style={{ ...card, width: 'min(94vw,700px)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Держите лицо в рамке</h1>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>Лиц в кадре: {faces}</div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1/1',
              borderRadius: 20,
              overflow: 'hidden',
              background: '#000',
              marginTop: 12,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>

          <div style={small}>{status}</div>
          <canvas ref={snapRef} style={{ display: 'none' }} />
        </section>
      )}

      {step === 'result' && (
        <section style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Результат</h1>
          {result?.ok ? (
            <div style={{ marginTop: 10, fontSize: 18 }}>
              {result.passed ? '✅ Верификация пройдена' : '❌ Верификация не пройдена'}
              {'dist' in (result || {}) && (
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>dist: {result?.dist?.toFixed?.(3)}</div>
              )}
            </div>
          ) : (
            <div style={{ color: '#ff4d4f', marginTop: 10 }}>Ошибка: {result?.msg || 'Неизвестная ошибка'}</div>
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
