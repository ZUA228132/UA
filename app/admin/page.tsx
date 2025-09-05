
'use client'
import { useEffect, useRef, useState } from 'react'

function drawBarChart(canvas: HTMLCanvasElement, data: {label:string, value:number}[]) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width = canvas.clientWidth
  const h = canvas.height = 180
  ctx.clearRect(0,0,w,h)
  const max = Math.max(1, ...data.map(d=>d.value))
  const barW = Math.max(10, Math.floor((w-20)/data.length)-6)
  data.forEach((d, i) => {
    const x = 10 + i*(barW+6)
    const y = h-20
    const bh = Math.round((d.value/max)*(h-40))
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(x, y-bh, barW, bh)
    ctx.fillStyle = '#999'
    ctx.font = '10px sans-serif'
    ctx.fillText(String(d.value), x, y-bh-4)
    ctx.save()
    ctx.translate(x+barW/2, h-5)
    ctx.rotate(-Math.PI/4)
    ctx.fillText(d.label, 0, 0)
    ctx.restore()
  })
}

export default function AdminPage(){
  const [initData, setInitData] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string>('')
  const chartRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    const id = (window as any)?.Telegram?.WebApp?.initData || ''
    setInitData(id)
  }, [])

  useEffect(()=>{
    if(!data || !chartRef.current) return
    const perDay = new Map<string, number>()
    for (const log of data.logs) {
      const d = new Date(log.at); const key = d.toISOString().slice(0,10)
      perDay.set(key, (perDay.get(key)||0)+1)
    }
    const items = Array.from(perDay.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([label,value])=>({label, value}))
    drawBarChart(chartRef.current!, items.slice(-20))
  }, [data])

  async function load(){
    setErr('')
    const res = await fetch('/api/admin/index', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, adminSecret: secret }) })
    if(!res.ok){ setErr('auth failed'); return }
    const js = await res.json(); setData(js)
  }

  async function approve(face_id:number){
    const note = prompt('Заметка (опционально)') || ''
    const res = await fetch('/api/admin/review/approve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, adminSecret: secret, face_id, note }) })
    if(res.ok) load()
  }
  async function reject(face_id:number){
    const note = prompt('Причина отказа?') || ''
    const res = await fetch('/api/admin/review/reject', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, adminSecret: secret, face_id, note }) })
    if(res.ok) load()
  }

  async function exportData(fmt:'json'|'csv'){
    const res = await fetch('/api/admin/export', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, adminSecret: secret, format: fmt }) })
    if(!res.ok) return
    if(fmt==='json'){
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'faces.json'; a.click()
    } else {
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'faces.csv'; a.click()
    }
  }

  async function importData(){
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]; if(!file) return
      const js = JSON.parse(await file.text())
      const res = await fetch('/api/admin/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, adminSecret: secret, faces: js.faces || js }) })
      if(res.ok) load()
    }
    input.click()
  }

  return (
    <main style={{ padding:16 }}>
      <h1>Админка</h1>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder='ADMIN_SECRET' value={secret} onChange={e=>setSecret(e.target.value)} style={{ padding:8, width:260 }}/>
        <button onClick={load}>Загрузить</button>
        <button onClick={()=>exportData('json')}>Экспорт JSON</button>
        <button onClick={()=>exportData('csv')}>Экспорт CSV</button>
        <button onClick={importData}>Импорт JSON</button>
        <span style={{ color:'tomato' }}>{err}</span>
      </div>

      {data && <>
        <section style={{ marginTop:16 }}>
          <h3>Активность (последние дни)</h3>
          <canvas ref={chartRef} style={{ width:'100%', height:180, border:'1px solid #333', borderRadius:8 }}/>
        </section>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 }}>
          <section>
            <h3>Очередь ревью</h3>
            <ul>
              {data.reviews.filter((r:any)=>r.status==='pending').map((r:any)=>(
                <li key={r.id} style={{ marginBottom:8 }}>
                  face #{r.face_id} — {r.display_name||'noname'} {r.image_url && <a href={r.image_url} target='_blank'>img</a>}
                  <button onClick={()=>approve(r.face_id)} style={{ marginLeft:8 }}>Одобрить</button>
                  <button onClick={()=>reject(r.face_id)} style={{ marginLeft:8 }}>Отклонить</button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Лица (последние)</h3>
            <ul>
              {data.faces.slice(0,50).map((f:any)=>(
                <li key={f.id}>#{f.id} — {f.display_name||'noname'} — {f.approved ? '✅' : '⏳'} — <a href={f.profile_url||'#'} target='_blank'>{f.profile_url||'—'}</a> {f.image_url && <a href={f.image_url} target='_blank'>img</a>}</li>
              ))}
            </ul>
          </section>
        </div>
      </>}
    </main>
  )
}
