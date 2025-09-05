'use client'
import { useEffect, useRef, useState } from 'react'

declare global { interface Window { human?: any; Human?: any; Telegram?: any } }

// парсим deep-link Telegram: bot?start=mode_verification_<faceId>
function parseMode() {
  const start = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || ''
  const parts = start.split('_')
  const mode = (parts[1] === 'verification') ? 'verification' : 'identification'
  const faceId = parts[2] ? Number(parts[2]) : undefined
  return { mode, faceId }
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const snapRef  = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [status, setStatus] = useState('Готово к верификации')
  const [faces, setFaces] = useState(0)
  const [verifying, setVerifying] = useState(false)

  const humanCfg: any = {
    modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
    warmup: 'face',
    face: {
      enabled: true,
      detector: { rotation: true, rotate: true, maxDetected: 1 },
      mesh: { enabled: true },
      description: { enabled: true }, // вектор для сервера
      iris: { enabled: false }, emotion: { enabled: false }, attention: { enabled: false }
    }
  }

  // простой aHash c канваса 8x8 → hex
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
    const start = Date.now()
    while (!(window.human || window.Human)) {
      if (Date.now() - start > 10000) throw new Error('Human UMD not loaded')
      await new Promise(r=>setTimeout(r,100))
    }
    let human:any
    if (window.human?.load) { human = window.human; try{ Object.assign(human.config ?? (human.config={}), humanCfg) }catch{} }
    else if (typeof window.Human === 'function') human = new (window as any).Human(humanCfg)
    else throw new Error('Unsupported UMD shape')
    await human.load(); await human.warmup()
    return human
  }

  async function startVerification() {
    try {
      setVerifying(true)
      setStatus('Подготовка…')

      const { mode, faceId } = parseMode()
      if (mode !== 'verification' || !faceId) {
        setVerifying(false)
        setStatus('Нет параметра faceId (deep-link).')
        return
      }

      const human = await ensureHuman()
      setStatus('Включаю камеру…')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:640}, height:{ideal:640} } })
      const v = videoRef.current!
      v.srcObject = stream; await v.play()

      // подготовим канвасы под размер видео
      const w = v.videoWidth || 640, h = v.videoHeight || 640
      const snap = snapRef.current!, ov = overlayRef.current!
      snap.width = ov.width = w; snap.height = ov.height = h

      setStatus('Сканирую лицо…')
      let best: any = null
      let goodFrames = 0
      const minGoodFrames = 8 // «живость»: несколько стабильных кадров

      const loop = async () => {
        if (!verifying) return
        const res = await human.detect(v, humanCfg)
        setFaces(res?.face?.length || 0)

        // рисуем рамку
        const ctx = ov.getContext('2d')!
        ctx.clearRect(0,0,w,h)
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,200,120,.9)'
        ctx.beginPath(); ctx.arc(w/2,h/2,Math.min(w,h)*0.35,0,Math.PI*2); ctx.stroke()
        if (res.face?.[0]?.box) {
          const b = res.face[0].box
          ctx.strokeStyle='rgba(80,220,60,.9)'; ctx.lineWidth=2; ctx.strokeRect(b[0],b[1],b[2],b[3])
        }

        // критерий качества: есть 1 лицо и есть descriptor
        if (res.face?.length === 1 && res.face[0].descriptor?.length) {
          goodFrames++
          // сохраняем «лучший» по площади bbox
          const area = res.face[0].box[2] * res.face[0].box[3]
          if (!best || area > best.area) best = { res: res.face[0], area }
        } else {
          goodFrames = 0
        }

        if (goodFrames >= minGoodFrames && best) {
          // снимаем кадр (без кнопки)
          const snapCtx = snap.getContext('2d')!
          snapCtx.drawImage(v, 0, 0, w, h)
          const dataUrl = snap.toDataURL('image/jpeg', 0.92)
          const ahash = aHashFromCanvas(snap)
          const descriptor = Array.from(best.res.descriptor as number[])

          setStatus('Проверяю на сервере…')
          // отправляем на сервер-«админ»:
          const r = await fetch('/api/verify-mode', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ face_id: faceId, dataUrl, ahash, descriptor })
          })
          const json = await r.json()
          // остановим камеру
          ;(v.srcObject as MediaStream).getTracks().forEach(t=>t.stop())

          if (!r.ok) {
            setVerifying(false)
            setStatus('Ошибка верификации: ' + (json.error || r.statusText))
            return
          }
          if (json.passed) {
            setStatus('Верификация пройдена ✅')
          } else {
            setStatus('Верификация не пройдена ❌')
          }
          setVerifying(false)
          return
        }

        // ~120мс
        setTimeout(loop, 120)
      }
      loop()
    } catch (e:any) {
      setVerifying(false)
      setStatus('Ошибка: ' + (e?.message || String(e)))
    }
  }

  useEffect(() => {
    return () => {
      const s = (videoRef.current?.srcObject as MediaStream|undefined)
      s?.getTracks().forEach(t=>t.stop())
    }
  }, [])

  return (
    <main style={{ padding: 16, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1>Верификация</h1>
      <p>{status} — Лиц: {faces}</p>

      {!verifying && (
        <button onClick={startVerification}
          style={{ padding:'10px 16px', border:'none', borderRadius:10, background:'#0ea5e9', color:'#fff', fontWeight:600 }}>
          Пройти верификацию
        </button>
      )}

      <div style={{ position:'relative', width:'min(92vw,640px)', marginTop:12 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', borderRadius:16, background:'#000' }} />
        <canvas ref={overlayRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
      </div>

      {/* скрытый канвас для кадра */}
      <canvas ref={snapRef} style={{ display:'none' }} />
    </main>
  )
}
