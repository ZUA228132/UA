'use client'
export const dynamic = 'force-dynamic'

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

  const [step, setStep] = useState<'welcome' | 'camera' | 'success'>('welcome')
  const [agree, setAgree] = useState(false)
  const [userName, setUserName] = useState('Гость')
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [faces, setFaces] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user
      if (u) {
        setUserName(`${u.first_name} ${u.last_name || ''}`)
        if (u.photo_url) setUserPhoto(u.photo_url)
      }
    }
  }, [])

  async function handleStart() {
    if (!agree) {
      alert('Нужно согласиться на обработку данных')
      return
    }
    setStep('camera')

    let human: any = null

    if (window.human && typeof window.human.load === 'function') {
      human = window.human
    } else if (typeof window.Human === 'function') {
      human = new window.Human()
      window.human = human
    } else {
      alert('Human.js не загружен')
      return
    }

    await human.load()
    await human.warmup()

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    })
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }

    const loop = async () => {
      if (videoRef.current) {
        const res = await human.detect(videoRef.current)
        setFaces(res.face.length)
        drawOverlay(res)

        // если нашли лицо → успех
        if (res.face.length > 0) {
          setTimeout(() => setStep('success'), 1200)
          return
        }
      }
      requestAnimationFrame(loop)
    }
    loop()
  }

  function drawOverlay(res: any) {
    const o = overlayRef.current!
    const ctx = o.getContext('2d')!
    o.width = videoRef.current?.videoWidth || 640
    o.height = videoRef.current?.videoHeight || 480

    ctx.clearRect(0, 0, o.width, o.height)

    // затемнение
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, o.width, o.height)

    // вырезанный круг (FaceID-style)
    const cx = o.width / 2, cy = o.height / 2
    const r = Math.min(o.width, o.height) * 0.35
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // рамка
    ctx.lineWidth = 4
    ctx.strokeStyle = res.face.length > 0 ? '#10b981' : '#9ca3af'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 font-sans px-4">
      {step === 'welcome' && (
        <div className="w-full max-w-sm p-8 rounded-2xl bg-white shadow-xl text-center">
          {userPhoto ? (
            <img src={userPhoto} alt="avatar" className="w-24 h-24 rounded-full mx-auto mb-4 shadow-md" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300 mx-auto mb-4 flex items-center justify-center text-2xl">👤</div>
          )}
          <h1 className="text-2xl font-semibold mb-2">Привет, {userName} 👋</h1>
          <p className="text-gray-500 mb-6">Для продолжения пройди FaceID-верификацию</p>

          <label className="flex items-center gap-2 mb-6 cursor-pointer text-sm text-gray-700 justify-center">
            <input
              type="checkbox"
              checked={agree}
              onChange={e => setAgree(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span>Согласен на обработку данных</span>
          </label>

          <button
            onClick={handleStart}
            disabled={!agree}
            className={`w-full py-3 rounded-xl text-white font-medium transition ${
              agree ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            🚀 Пройти верификацию
          </button>
        </div>
      )}

      {step === 'camera' && (
        <div className="relative w-full max-w-md">
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" />
          <p className="text-center mt-4 text-gray-400">Поместите лицо в круг</p>
        </div>
      )}

      {step === 'success' && (
        <div className="w-full max-w-sm p-8 rounded-2xl bg-white shadow-xl text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-4xl text-emerald-500">✔</span>
          </div>
          <h1 className="text-2xl font-semibold mb-2">Верификация пройдена</h1>
          <p className="text-gray-500">Спасибо, {userName}! Теперь доступ открыт 🎉</p>
        </div>
      )}
    </main>
  )
}
