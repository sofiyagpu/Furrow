import { useRef, useState } from 'react'
import type { Region } from './types'
import { sname, useLang, type Lang } from './fmt'

// Light agent: answers from the precomputed results only, never invents a number.
// ponytail: keyword intents, swap for an LLM with these JSON results as tools if the demo needs free chat.
const usd = (v: number, l: Lang) => `${v < 0 ? (l === 'ru' ? 'минус ' : 'minus ') : ''}$${Math.abs(Math.round(v))}`

export function answer(q: string, r: Region, l: Lang = 'en'): string {
  const s = r.strategies
  const T = (en: string, ru: string) => (l === 'ru' ? ru : en)
  const n = (x: (typeof s)[number]) => sname(x, l)
  const lab = (x: (typeof s)[number]) => (x.id === 'current' ? T('Current', 'Сейчас') : T('Strategy ', 'Стратегия ') + x.id)
  const t = q.toLowerCase()
  const by = (f: (x: (typeof s)[number]) => number) => [...s].sort((a, b) => f(b) - f(a))[0]
  const tail = T(' This is a model comparison for your agronomist to check, not a recommendation.', ' Это сравнение моделей для проверки агрономом, а не рекомендация.')
  if (/erosion|wind|dust|эрози|ветер|пыль/.test(t)) {
    const b = by((x) => -x.metrics.erosion)
    return T(`Least soil loss: ${n(b)}, about ${b.metrics.erosion} t/ha a year against ${s[0].metrics.erosion} now, with ${b.metrics.bare_days} bare days a year instead of ${s[0].metrics.bare_days}.`,
      `Меньше всего эрозии: ${n(b)}, около ${b.metrics.erosion} т/га в год против ${s[0].metrics.erosion} сейчас, голых дней ${b.metrics.bare_days} вместо ${s[0].metrics.bare_days}.`) + tail
  }
  if (/carbon|credit|soc|углерод|органик|кредит/.test(t)) {
    const b = by((x) => x.carbon.t_co2_ha_yr)
    return T(`${n(b)} stores the most extra soil carbon: about ${b.carbon.t_co2_ha_yr} t CO2e per hectare a year over current practice, worth ${usd(b.carbon.usd_ha_yr[0], l)} to ${usd(b.carbon.usd_ha_yr[1], l)} per hectare if a registry verifies it with soil samples.`,
      `${n(b)} накапливает больше всего углерода: около ${b.carbon.t_co2_ha_yr} т CO2e на гектар в год сверх текущей практики, это ${usd(b.carbon.usd_ha_yr[0], l)}–${usd(b.carbon.usd_ha_yr[1], l)} на гектар, если реестр подтвердит пробами почвы.`) + tail
  }
  if (/water|irrigat|pump|aquifer|вод|полив/.test(t)) {
    if (!r.irrigated) return T('This region is rain-fed, so the question is stored moisture. See soil water in each year in the time machine.', 'Здесь богара, поэтому вопрос — накопленная влага. Влагу почвы по годам смотрите в машине времени.') + tail
    const b = by((x) => x.water_saved_mm)
    return T(`${n(b)} pumps about ${b.water_saved_mm} mm a year less than current practice, roughly ${Math.round(b.water_saved_mm * 10)} cubic metres per hectare.`,
      `${n(b)} откачивает примерно на ${b.water_saved_mm} мм в год меньше текущей практики, около ${Math.round(b.water_saved_mm * 10)} кубометров на гектар.`) + tail
  }
  if (/drought|dry|worst|bad year|засух|сух|худш|плох/.test(t)) {
    const lines = s.map((x) => {
      const w = [...x.timeline].sort((a, b) => a.profit[1] - b.profit[1])[0]
      return T(`${lab(x)}: worst year ${w.year}, ${usd(w.profit[1], l)} per hectare`, `${lab(x)}: худший год ${w.year}, ${usd(w.profit[1], l)} на гектар`)
    })
    return `${lines.join('; ')}.` + tail
  }
  if (/warm|hot|climate|\+2|degree|климат|тепл|градус/.test(t)) {
    const i = r.twin.dT.indexOf(2), j = r.twin.dP.findIndex((x) => Math.abs(x + 0.1) < 1e-6)
    const lines = s.map((x) => `${lab(x)}: ${usd(r.twin.grid[x.id][i][j].profit[1], l)}`)
    return T(`At 2 °C warmer and 10% less rain, the median profit per hectare becomes ${lines.join(', ')}. This is a scenario, not a forecast.`,
      `При +2 °C и на 10% меньше осадков медианная прибыль на гектар: ${lines.join(', ')}. Это сценарий, а не прогноз.`) + tail
  }
  if (/best|which|recommend|profit|money|лучш|выгод|доход|какую|прибыл/.test(t)) {
    const b = by((x) => x.metrics.profit[1])
    const safe = by((x) => x.metrics.profit[0])
    return T(`Highest median profit: ${n(b)}, ${usd(b.metrics.profit[1], l)} per hectare a year. Safest in a bad year: ${n(safe)}, ${usd(safe.metrics.profit[0], l)} in the worst one year in ten.`,
      `Самая высокая медианная прибыль: ${n(b)}, ${usd(b.metrics.profit[1], l)} на гектар в год. Надёжнее всего в плохой год: ${n(safe)}, ${usd(safe.metrics.profit[0], l)} в худший год из десяти.`) + tail
  }
  return T('Ask me about profit, erosion, soil carbon, water, drought years or a warmer climate.', 'Спросите о прибыли, эрозии, углероде, воде, засушливых годах или потеплении.')
}

type SR = { lang: string; start(): void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void }

export default function Agent({ region }: { region: Region }) {
  const l = useLang()
  const T = (en: string, ru: string) => (l === 'ru' ? ru : en)
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<{ q: string; a: string }[]>([])
  const [q, setQ] = useState('')
  const [listening, setListening] = useState(false)
  const rec = useRef<SR | null>(null)
  const Speech = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR })
  const SRCtor = Speech.SpeechRecognition ?? Speech.webkitSpeechRecognition
  const voice = l === 'ru' ? 'ru-RU' : 'en-US'

  function ask(text: string) {
    if (!text.trim()) return
    const a = answer(text, region, l)
    setLog((x) => [...x, { q: text, a }])
    setQ('')
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(a), { lang: voice }))
    }
  }

  function listen() {
    if (!SRCtor) return
    const r = new SRCtor()
    r.lang = voice
    r.onresult = (e) => ask(e.results[0][0].transcript)
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }

  const chips = l === 'ru'
    ? ['Какая стратегия выгоднее?', 'Что в засушливый год?', 'Сколько углерода?', 'Что если станет на 2 градуса теплее?']
    : ['Which strategy pays best?', 'What about a drought year?', 'How much carbon?', 'What if it gets 2 degrees warmer?']

  return (
    <>
      <button className="btn btn-solid agent-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? T('Close', 'Закрыть') : T('Ask the field', 'Спросить поле')}
      </button>
      {open && (
        <aside className="agent" aria-label={T('Field assistant', 'Помощник по полю')}>
          <h2 className="h-sm">{T('Field assistant', 'Помощник по полю')}</h2>
          <p className="muted small">{T('Answers come only from the model runs on this page.', 'Ответы берутся только из расчётов на этой странице.')}</p>
          <div className="agent-log">
            {log.map((m, i) => (
              <div key={i}>
                <p className="agent-q">{m.q}</p>
                <p className="agent-a">{m.a}</p>
              </div>
            ))}
          </div>
          <div className="chips">
            {chips.map((x) => <button key={x} className="chip" onClick={() => ask(x)}>{x}</button>)}
          </div>
          <form className="agent-form" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
            <label className="sr-only" htmlFor="agent-q">{T('Your question', 'Ваш вопрос')}</label>
            <input id="agent-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('Type a question', 'Введите вопрос')} />
            {SRCtor && (
              <button type="button" className="btn btn-ghost" onClick={listen} aria-pressed={listening}>
                {listening ? T('Listening', 'Слушаю') : T('Speak', 'Голосом')}
              </button>
            )}
            <button className="btn btn-solid">{T('Send', 'Отправить')}</button>
          </form>
        </aside>
      )}
    </>
  )
}
