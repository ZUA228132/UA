'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    human?: any
    Human?: any
    Telegram?: any
  }
}

type Step = 'intro' | 'scanning' | 'result'

function useTelegramUser() {
  return useMemo(() => {
    const unsafe = (window as any).Telegram?.WebApp?.initDataUnsafe
    const user = unsafe?.user
    const name = user?.first_name || user?.username || 'Пользователь'
    const id = user?.id ?? null
    const startParam = unsafe?.start_param || ''
    return { name, id, startParam }
  }, [])
}

// парсим deep-link: bot?start=mode_verification_<faceId>
function parseMode(startParam: string) {
  const parts = String(startParam || '').split('_')
  const mode = (parts[1] === 'verification') ? 'verification' : 'identification'
  const faceId = parts[2] ? Number(parts[2]) : undefined
  return { mode, faceId }
}

export default function Page() {
  const { name, id: tgUserId, startParam } = useTelegramUser()
  const { mode, faceId } = parseMode(startParam)

  const [step, setStep] = useState<Step>('intro')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [faces, setFaces] = useState(0)
  const [result, setResult] = useState<{ ok?: boolean; passed?: boolean; dist?: number; msg?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const snapRef  = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const humanCfg: any = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    warmup: 'face',
    face: {
      enabled: true,
      detector: { rotation: true, rotate: true, maxDetected: 1 },
      mesh: { enabled: true },
      description: { enabled: true },
      iris: { enabled: false }, emotion: { enabled: false }, attention: { enabled: false },
    }
  }

  function aHashFromCanvas(canvas: HTMLCanvasElement): string {
    const w=8, h=8
    const t = document.createElement('canvas'); t.width=w; t.height=h
    const tctx = t.getContext('2d')!
    tctx.drawImage(canvas, 0, 0, w, h)
    const { data } = tctx.getImageData(0,0,w,h)
    let sum=0; const g:number[]=[]
    for (let i=0;i<data.length;i+=4){ const v=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2]; g.push(v); sum+=v }
    const avg = sum/g.length
    let bits=''; for (const v of g) bits += (v>avg?'1':'0')
    return BigInt('0b'+bits).toString(16).padStart(16,'0')
  }

  async function ensureHuman() {
    const startT = Date.now()
    while (!(window.human || window.Human)) {
      if (Date.now() - startT > 10000) throw new Error('Human UMD not loaded')
      await new Promise(r=>setTimeout(r,100))
    }
    let human:any
    if (window.human?.load) { human = window.human; try{ Object.assign(human.config ?? (human.config={}), humanCfg) }catch{} }
    else if (typeof window.Human === 'function') human = new (window as any).Human(humanCfg)
    else throw new Error('Unsupported UMD shape')
    await human.load(); await human.warmup()
    return human
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
        video: { facingMode:'user', width:{ideal:640}, height:{ideal:640} },
        audio: false
      })
      const v = videoRef.current!
      v.srcObject = stream; await v.play()

      const w = v.videoWidth || 640, h = v.videoHeight || 640
      const snap = snapRef.current!, ov = overlayRef.current!
      snap.width = ov.width = w; snap.height = ov.height = h

      setStep('scanning')
      setStatus('Сканируем… держите лицо в рамке')
      let goodFrames = 0
      let best: any = null
      const minGoodFrames = 8

      const loop = async () => {
        if (step !== 'scanning') return
        const res = await human.detect(v, humanCfg)
        setFaces(res?.face?.length || 0)

        const ctx = ov.getContext('2d')!
        ctx.clearRect(0,0,w,h)
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,130,255,0.9)'
        ctx.beginPath(); ctx.arc(w/2,h/2,Math.min(w,h)*0.34,0,Math.PI*2); ctx.stroke()

        if (res.face?.length === 1 && res.face[0].descriptor?.length) {
          goodFrames++
          const area = res.face[0].box[2] * res.face[0].box[3]
          if (!best || area > best.area) best = { res: res.face[0], area }
        } else {
          goodFrames = 0
        }

        if (goodFrames >= minGoodFrames && best) {
          const snapCtx = snap.getContext('2d')!
          snapCtx.drawImage(v, 0, 0, w, h)
          const dataUrl = snap.toDataURL('image/jpeg', 0.92)
          const ahash = aHashFromCanvas(snap)
          const descriptor = Array.from(best.res.descriptor as number[])

          ;(v.srcObject as MediaStream).getTracks().forEach(t=>t.stop())

          setStatus('Проверка…')
          const r = await fetch('/api/verify-mode', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ face_id: faceId, dataUrl, ahash, descriptor, tg_user_id: tgUserId, display_name: name })
          })
          const json = await r.json()
          if (!r.ok) {
            setResult({ ok:false, msg: json.error || r.statusText })
          } else {
            setResult({ ok:true, passed: json.passed, dist: json.dist })
          }
          setStep('result')
          setBusy(false)
          return
        }
        setTimeout(loop, 120)
      }
      loop()
    } catch (e: any) {
      setBusy(false)
      setStatus(e?.message || 'Ошибка доступа к камере')
    }
  }

  const wrap: React.CSSProperties = { minHeight: '100dvh', display:'grid', placeItems:'center', background:'#f5f5f7', color:'#0a0a0a' }
  const card: React.CSSProperties = { width:'min(92vw, 460px)', background:'#fff', borderRadius:24, boxShadow:'0 6px 30px rgba(0,0,0,0.08)', padding:24 }

  return (
    <div style={wrap}>
      {step === 'intro' && (
        <section style={card}>
          <h1 style={{ fontSize:28, fontWeight:700 }}>Верификация</h1>
          <div style={{ marginTop:6, marginBottom:18 }}>Здравствуйте, <b>{name}</b></div>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
            <span>Я согласен(на) на обработку изображения лица</span>
          </label>
          <button onClick={onStartVerification} disabled={busy}
            style={{ width:'100%', marginTop:16, padding:'14px 16px', borderRadius:14, border:'none',
                     background:'#0a84ff', color:'#fff', fontWeight:700, fontSize:16, cursor:'pointer' }}>
            Пройти верификацию
          </button>
          {status && <div style={{ fontSize:12, opacity:0.6, marginTop:12 }}>{status}</div>}
        </section>
      )}

      {step === 'scanning' && (
        <section style={{ ...card, width:'min(94vw,700px)' }}>
          <h1 style={{ fontSize:22, fontWeight:600 }}>Держите лицо в рамке</h1>
          <div style={{ position:'relative', width:'100%', aspectRatio:'1/1', borderRadius:16, overflow:'hidden', background:'#000' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <canvas ref={overlayRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
          </div>
          <div style={{ fontSize:12, opacity:0.6 }}>{status}</div>
          <canvas ref={snapRef} style={{ display:'none' }} />
        </section>
      )}

      {step === 'result' && (
        <section style={card}>
          <h1 style={{ fontSize:24, fontWeight:700 }}>Результат</h1>
          {result?.ok ? (
            <div style={{ marginTop:10, fontSize:18 }}>
              {result.passed ? '✅ Верификация пройдена' : '❌ Верификация не пройдена'}
            </div>
          ) : (
            <div style={{ color:'#d00', marginTop:10 }}>Ошибка: {result?.msg || 'Неизвестная ошибка'}</div>
          )}
          <button onClick={()=>{ setStep('intro'); setResult(null); setStatus(''); setConsent(false) }}
            style={{ width:'100%', marginTop:16, padding:'14px 16px', borderRadius:14, border:'none', background:'#34c759', color:'#fff', fontWeight:700 }}>
            Готово
          </button>
        </section>
      )}
    </div>
  )
}
