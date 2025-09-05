
'use client'
import { useEffect, useRef, useState } from 'react'
const loadHuman = async () => (await import('@vladmandic/human')).default

declare global { interface Window { Telegram: { WebApp: any } } }

function l2norm(v: number[]) { const s=Math.sqrt(v.reduce((a,b)=>a+b*b,0)||1); return v.map(x=>x/s) }
function avgVec(arr: number[][]){ const n=arr.length,d=arr[0].length; const s=new Array(d).fill(0); for(const v of arr) for(let i=0;i<d;i++) s[i]+=v[i]; return s.map(x=>x/n) }
function cosine(a:number[],b:number[]){ let dot=0,na=0,nb=0; for(let i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]} return dot/(Math.sqrt(na)*Math.sqrt(nb)+1e-9) }

export default function Page(){
  const [initData, setInitData] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [embedding, setEmbedding] = useState<number[] | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [deepMode, setDeepMode] = useState<'none'|'verification'|'identification'>('none')
  const [deepSubject, setDeepSubject] = useState<number|undefined>(undefined)

  const videoRef = useRef<HTMLVideoElement>(null)
  const drawRef = useRef<HTMLCanvasElement>(null)
  const [human, setHuman] = useState<any>(null)

  const FRAMES = 16
  const SIM_MIN = 0.86
  const YAW_MIN = 12
  const BLINK_DROP = 0.25
  const SPEC_MIN = 0.0005
  const MOIRE_MAX = 40000
  const MICRO_MIN = 0.0015

  useEffect(()=>{
    const app = window.Telegram?.WebApp; app?.expand(); const init = app?.initData || null; setInitData(init)
    // also allow deep params via URL: ?mode=verification&subjectId=123
    const qp = new URLSearchParams(window.location.search)
    let mode = qp.get('mode'); let sid = qp.get('subjectId')
    // try start_param inside initData (if BotFather link used)
    if (init) {
      try {
        const sp = decodeURIComponent((new URLSearchParams(init)).get('start_param') || '')
        if (sp) { const up = new URLSearchParams(sp.replace(/\+/g, '&')); mode = mode || up.get('mode') || undefined as any; sid = sid || up.get('subjectId') || undefined as any }
      } catch {}
    }
    if (mode === 'verification' || mode === 'identification') setDeepMode(mode as any)
    if (sid) setDeepSubject(Number(sid))
    ;(async()=>{
      const Human = await loadHuman()
      const h = new Human({ modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
        face: { enabled:true, detector:{ rotation:true, rotate:true, maxDetected:1 }, mesh:{ enabled:true }, description:{ enabled:true } } })
      await h.load(); setHuman(h); setStatus('Готово. Жми «Камера», затем «Скан».')
    })()
  }, [])

  async function camera(){ const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}); if(videoRef.current){ videoRef.current.srcObject=s; await videoRef.current.play() } }

  function drawBox(face:any){ const c=drawRef.current, v=videoRef.current; if(!c||!v) return; c.width=v.videoWidth; c.height=v.videoHeight; const ctx=c.getContext('2d')!; ctx.clearRect(0,0,c.width,c.height); if(!face?.box) return; const [x,y,w,h]=face.box; ctx.lineWidth=3; ctx.strokeStyle='#22c55e'; ctx.strokeRect(x,y,w,h) }

  async function scan(){
    if(!videoRef.current||!human) return
    const v=videoRef.current
    const canv=document.createElement('canvas'); canv.width=v.videoWidth; canv.height=v.videoHeight
    const ctx=canv.getContext('2d')!
    const embeds:number[][]=[]; let yawMax=0; let eyeBase=0; let blink=false; let simsAvg=0
    // basic spec/moire metrics on first frame
    let specVal=0, moireVal=0
    setProgress(0)

    for(let i=0;i<FRAMES;i++){
      ctx.drawImage(v,0,0,canv.width,canv.height)
      const id=ctx.getImageData(0,0,canv.width,canv.height)
      const res=await human.detect(canv); const face=res.face?.[0]; drawBox(face)
      if(face?.embedding){ const e=l2norm(Array.from(face.embedding)); embeds.push(e) }
      const yaw=(face?.rotation?.angle?.yaw ?? 0)*(180/Math.PI); yawMax=Math.max(yawMax, Math.abs(yaw))
      // blink proxy
      const lmk=face?.mesh; if(Array.isArray(lmk)&&lmk.length>386){ const L_UP=lmk[159],L_DN=lmk[145],R_UP=lmk[386],R_DN=lmk[374]; if(L_UP&&L_DN&&R_UP&&R_DN){ const dyL=Math.hypot(L_UP[0]-L_DN[0],L_UP[1]-L_DN[1]); const dyR=Math.hypot(R_UP[0]-R_DN[0],R_UP[1]-R_DN[1]); const open=(dyL+dyR)/2; if(eyeBase===0) eyeBase=open; if(eyeBase>0 && open<eyeBase*(1-BLINK_DROP)) blink=true } }
      if(i===0){ // lightweight spec/moire approximations
        // spec variance
        let sum=0,sum2=0; const d=id.data; const n=d.length/4
        for(let k=0;k<d.length;k+=4){ const l=0.2126*d[k]+0.7152*d[k+1]+0.0722*d[k+2]; sum+=l; sum2+=l*l }
        const mean=sum/n; specVal = (sum2/n - mean*mean)/(255*255)
        // pseudo moire energy: sample every 4th pixel gradient
        let e=0, cnt=0
        for(let y=0;y<id.height;y+=4){
          for(let x=4;x<id.width;x+=4){
            const p=(y*id.width + x)*4, q=(y*id.width + (x-4))*4
            const l1=0.299*d[p]+0.587*d[p+1]+0.114*d[p+2]
            const l0=0.299*d[q]+0.587*d[q+1]+0.114*d[q+2]
            e += Math.abs(l1-l0); cnt++
          }
        }
        moireVal = e/(cnt||1)
      }
      setProgress(Math.round(((i+1)/FRAMES)*100))
      await new Promise(r=>setTimeout(r, 70))
    }
    if(embeds.length===0){ setStatus('Лицо не найдено'); return }
    const avg=l2norm(avgVec(embeds)); const sims=embeds.map(e=>cosine(e,avg)); simsAvg = sims.reduce((a,b)=>a+b,0)/sims.length
    const stable = sims.every(s=>s>=SIM_MIN)
    const micro = (()=>{ let sum=0,cnt=0; for(let i=1;i<embeds.length;i++){ for(let k=0;k<embeds[i].length;k++){ const dx=embeds[i][k]-embeds[i-1][k]; sum+=Math.abs(dx); cnt++ } } return sum/(cnt||1) })() // proxy
    const metricsObj = { spec: specVal, moire: moireVal, micromove: micro, yawMax, blink, simsAvg }
    setMetrics(metricsObj)

    const pass = stable && yawMax>=YAW_MIN && blink && specVal>=SPEC_MIN && moireVal<=MOIRE_MAX && micro>=MICRO_MIN
    if(!pass){ setStatus('Антиспуф/живость не пройдены'); setEmbedding(null); return }
    setEmbedding(avg)
    setStatus('OK: эмбеддинг готов')
    setPreviewUrl(canv.toDataURL('image/jpeg',0.92))
  }

  async function enroll(){
    if(!embedding||!initData) return
    const displayName = window.prompt('Имя?') || ''
    const profileUrl = window.prompt('Профиль (опционально)?') || ''
    const res = await fetch('/api/enroll',{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ initData, embedding, displayName, profileUrl, imageDataUrl: previewUrl, metrics })})
    const js=await res.json(); if(!res.ok) setStatus('Enroll error'); else setStatus('Отправлено на ревью, face_id='+js.id)
  }

  async function identify(){
    if(!embedding||!initData) return
    const thr = Number(window.prompt('Порог 0..1', '0.6')||'0.6')
    const topK = Number(window.prompt('topK', '5')||'5')
    const res = await fetch('/api/verify-mode',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ initData, mode:'identification', embedding, topK, minSimilarity: thr, metrics }) })
    const js=await res.json(); if(!res.ok){ setStatus('Identify error'); return }
    alert(JSON.stringify(js.results, null, 2))
  }

  async function verify1to1(){
    if(!embedding||!initData) return
    const id = deepSubject ?? Number(window.prompt('ID лица для 1:1?')||'0')
    const thr = Number(window.prompt('Порог 0..1', '0.6')||'0.6')
    const res = await fetch('/api/verify-mode',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ initData, mode:'verification', embedding, subjectId:id, minSimilarity:thr, metrics }) })
    const js=await res.json(); if(!res.ok){ setStatus('Verify error'); return }
    alert(`Match: ${js.match} (sim ${(js.similarity*100).toFixed(1)}%)`)
  }

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>FaceID‑подобный WebApp — Enterprise</h1>
      <p style={{ opacity: 0.85 }}>{status}</p>
      {deepMode !== 'none' && <p style={{ fontSize: 14, opacity: 0.8 }}>Deep‑link режим: <b>{deepMode}</b>{deepSubject ? `, subjectId=${deepSubject}` : ''}</p>}

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', margin:'10px 0' }}>
        <button onClick={camera}>Камера</button>
        <button onClick={scan}>Скан + антиспуф</button>
        <button onClick={enroll} disabled={!embedding}>📥 Enroll (на ревью)</button>
        <button onClick={identify} disabled={!embedding}>🔎 Identify (1:N)</button>
        <button onClick={verify1to1} disabled={!embedding || (deepMode==='verification' && !deepSubject)}>✅ Verify (1:1)</button>
      </div>

      <div style={{ position:'relative' }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', borderRadius:12, background:'#000' }}/>
        <canvas ref={drawRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ height: 10, background: '#222', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ width: progress+'%', height: '100%', background: '#22c55e' }} />
        </div>
      </div>

      {previewUrl && <div style={{ marginTop: 12 }}>
        <img src={previewUrl} alt="snap" style={{ maxWidth: '100%', borderRadius: 12 }} />
      </div>}
    </main>
  )
}
