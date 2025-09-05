'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    Human: any
  }
}

export default function Page() {
  const [status, setStatus] = useState('Loading...')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let isActive = true

    ;(async () => {
      try {
        const human = window.Human
        if (!human) throw new Error('Human not loaded')

        await human.init({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
          face: { enabled: true, detector: { rotation: true, maxDetected: 1 } },
        })

        // включаем камеру
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setStatus(`✅ Human ready v${human.version}`)

        // цикл детекции и отрисовки
        const detectLoop = async () => {
          if (!isActive) return

          if (videoRef.current && canvasRef.current) {
            const result = await human.detect(videoRef.current)

            // обновляем статус
            setStatus(`✅ Human v${human.version} | Faces: ${result.face.length}`)

            // рисуем рамки
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
              ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)

              result.face.forEach((face: any) => {
                const box = face.box
                ctx.strokeStyle = 'lime'
                ctx.lineWidth = 3
                ctx.strokeRect(box[0], box[1], box[2], box[3])

                ctx.font = '16px Arial'
                ctx.fillStyle = 'lime'
                ctx.fillText('Face', box[0], box[1] > 20 ? box[1] - 5 : 10)
              })
            }
          }
          requestAnimationFrame(detectLoop)
        }
        detectLoop()
      } catch (e: any) {
        setStatus('Human error: ' + e.message)
      }
    })()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main style={{ padding: 20 }}>
      <h1>Human via CDN (UMD)</h1>
      <p>{status}</p>

      <div style={{ position: 'relative', width: 320, height: 240 }}>
        {/* Камера */}
        <video
          ref={videoRef}
          width={320}
          height={240}
          style={{ display: 'none' }} // прячем видео, будем рисовать на canvas
        />
        {/* Канвас с рамкой */}
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          style={{ border: '1px solid black' }}
        />
      </div>
    </main>
  )
}
