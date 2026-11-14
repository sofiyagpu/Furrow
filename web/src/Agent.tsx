import { useRef, useState } from 'react'
import type { Region } from './types'

// Light agent: answers from the precomputed results only, never invents a number.
// ponytail: keyword intents, swap for an LLM with these JSON results as tools if the demo needs free chat.
const usd = (v: number) => `$${Math.round(v)}`

export function answer(q: string, r: Region): string {
  const s = r.strategies
  const t = q.toLowerCase()
  const by = (f: (x: (typeof s)[number]) => number) => [...s].sort((a, b) => f(b) - f(a))[0]
  const tail = ' This is a model comparison for your agronomist to check, not a recommendation.'
  if (/erosion|wind|dust|эрози|ветер|пыль/.test(t)) {
    const b = by((x) => -x.metrics.erosion)
    return `Least soil loss: ${b.name}, about ${b.metrics.erosion} t/ha a year against ${s[0].metrics.erosion} now, with ${b.metrics.bare_days} bare days a year instead of ${s[0].metrics.bare_days}.` + tail
  }
  if (/carbon|credit|soc|углерод|органик/.test(t)) {
    const b = by((x) => x.carbon.t_co2_ha_yr)
    return `${b.name} stores the most extra soil carbon: about ${b.carbon.t_co2_ha_yr} t CO2e per hectare a year over current practice, worth ${usd(b.carbon.usd_ha_yr[0])} to ${usd(b.carbon.usd_ha_yr[1])} per hectare if a registry verifies it with soil samples.` + tail
  }
  if (/water|irrigat|pump|aquifer|вод|полив/.test(t)) {
    if (!r.irrigated) {
      return `${r.name} is rain-fed here, so the question is stored moisture. Open the time machine to see soil water at sowing in each year.` + tail
    }
    const b = by((x) => x.water_saved_mm)
    return `${b.name} pumps about ${b.water_saved_mm} mm a year less than current practice, roughly ${Math.round(b.water_saved_mm * 10)} cubic metres per hectare.` + tail
  }
  if (/drought|dry|worst|bad year|засух|сух|худш/.test(t)) {
    const lines = s.map((x) => {
      const w = [...x.timeline].sort((a, b) => a.profit[1] - b.profit[1])[0]
      return `${x.id === 'current' ? 'Current' : 'Strategy ' + x.id}: worst year ${w.year}, ${usd(w.profit[1])} per hectare`
    })
    return `${lines.join('; ')}.` + tail
  }
  if (/warm|hot|climate|\+2|degree|климат|тепл|градус/.test(t)) {
    const i = r.twin.dT.indexOf(2), j = r.twin.dP.indexOf(-0.1)
    const lines = s.map((x) => `${x.id === 'current' ? 'current' : x.id}: ${usd(r.twin.grid[x.id][i][j].profit[1])}`)
    return `At 2 °C warmer and 10% less rain, the median profit per hectare becomes ${lines.join(', ')}. This is a scenario, not a forecast.` + tail
  }
  if (/best|which|recommend|profit|money|лучш|выгод|доход|какую/.test(t)) {
    const b = by((x) => x.metrics.profit[1])
    const safe = by((x) => x.metrics.profit[0])
    return `Highest median profit: ${b.name}, ${usd(b.metrics.profit[1])} per hectare a year. Safest in a bad year: ${safe.name}, ${usd(safe.metrics.profit[0])} in the worst one year in ten.` + tail
  }
  return 'Ask me about profit, erosion, soil carbon, water, drought years or a warmer climate.'
}

type SR = { lang: string; start(): void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void }

export default function Agent({ region }: { region: Region }) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<{ q: string; a: string }[]>([])
  const [q, setQ] = useState('')
  const [listening, setListening] = useState(false)
  const rec = useRef<SR | null>(null)
  const Speech = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR })
  const SRCtor = Speech.SpeechRecognition ?? Speech.webkitSpeechRecognition

  function ask(text: string) {
    if (!text.trim()) return
    const a = answer(text, region)
    setLog((l) => [...l, { q: text, a }])
    setQ('')
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      speechSynthesis.speak(new SpeechSynthesisUtterance(a))
    }
  }

  function listen() {
    if (!SRCtor) return
    const r = new SRCtor()
    r.lang = 'en-US'
    r.onresult = (e) => ask(e.results[0][0].transcript)
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <>
      <button className="btn btn-solid agent-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Close the assistant' : 'Ask about this field'}
      </button>
      {open && (
        <aside className="agent" aria-label="Field assistant">
          <h2 className="h-sm">Field assistant</h2>
          <p className="muted small">Answers come from the model runs on this page, nothing else.</p>
          <div className="agent-log">
            {log.map((m, i) => (
              <div key={i}>
                <p className="agent-q">{m.q}</p>
                <p className="agent-a">{m.a}</p>
              </div>
            ))}
          </div>
          <div className="chips">
            {['Which strategy pays best?', 'What about a drought year?', 'How much carbon?', 'What if it gets 2 degrees warmer?'].map((x) => (
              <button key={x} className="chip" onClick={() => ask(x)}>{x}</button>
            ))}
          </div>
          <form className="agent-form" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <label className="sr-only" htmlFor="agent-q">Your question</label>
            <input id="agent-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question" />
            {SRCtor && (
              <button type="button" className="btn btn-ghost" onClick={listen} aria-pressed={listening}>
                {listening ? 'Listening' : 'Speak'}
              </button>
            )}
            <button className="btn btn-solid">Send question</button>
          </form>
        </aside>
      )}
    </>
  )
}
