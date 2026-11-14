import { useEffect, useMemo, useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis, ReferenceLine, Cell as RCell,
} from 'recharts'
import MapView, { NASA_LAYERS, type MetricKey, type NasaLayer } from './MapView'
import Agent from './Agent'
import Report from './Report'
import { SecHead } from './SecHead'
import type { Region, Strategy } from './types'
import { SC, usd, short, sname, cropShort, rname, LangCtx, useLang, useT, type Lang } from './fmt'

const METRICS: Record<MetricKey, [string, string]> = {
  profit: ['Median profit, $/ha', 'Медианная прибыль, $/га'],
  erosion: ['Soil loss, t/ha a year', 'Потеря почвы, т/га в год'],
  dsoc: ['Soil carbon change, t C/ha a year', 'Изменение углерода, т C/га в год'],
  irr: ['Pumped water, mm a year', 'Откачка воды, мм в год'],
}

const stored = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const store = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode: lasts this visit */ } }

export default function App() {
  const [rid, setRid] = useState<'vko' | 'az'>(() => (new URLSearchParams(location.search).get('r') === 'az' ? 'az' : 'vko'))
  const [lang, setLang] = useState<Lang>(() => (stored('lang') ?? (navigator.language.startsWith('ru') ? 'ru' : 'en')) as Lang)
  const [data, setData] = useState<Record<string, Region>>({})
  const r = data[rid]
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  useEffect(() => {
    if (data[rid]) return
    fetch(`${import.meta.env.BASE_URL}data/${rid}.json`).then((x) => x.json()).then((d) => setData((o) => ({ ...o, [rid]: d })))
  }, [rid, data])
  useEffect(() => { document.documentElement.lang = lang; store('lang', lang) }, [lang])

  return (
    <LangCtx.Provider value={lang}>
      <a className="skip" href="#main">{t('Skip to content', 'К содержанию')}</a>
      <header className="nav">
        <div className="wrap nav-in">
          <a href="#top" className="mark" aria-label="Furrow">furrow<span>.</span></a>
          <nav aria-label={t('Sections', 'Разделы')} className="nav-links">
            <a href="#map">{t('Map', 'Карта')}</a>
            <a href="#strategies">{t('Strategies', 'Стратегии')}</a>
            <a href="#time">{t('Time machine', 'Машина времени')}</a>
            <a href="#twin">{t('Climate', 'Климат')}</a>
            <a href="#tradeoffs">{t('Trade-offs', 'Компромиссы')}</a>
            <a href="#carbon">{t('Carbon and water', 'Углерод и вода')}</a>
            <a href="#ml">ML</a>
            <a href="#report">{t('Report', 'Отчёт')}</a>
          </nav>
          {r && <Agent key={rid + lang} region={r} />}
          <div className="seg" role="group" aria-label={t('Region', 'Регион')}>
            <button aria-pressed={rid === 'vko'} onClick={() => setRid('vko')}>{t('Kazakhstan', 'ВКО')}</button>
            <button aria-pressed={rid === 'az'} onClick={() => setRid('az')}>{t('Arizona', 'Аризона')}</button>
          </div>
          <div className="seg" role="group" aria-label={t('Language', 'Язык')}>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
            <button aria-pressed={lang === 'ru'} onClick={() => setLang('ru')} lang="ru">RU</button>
          </div>
          <Theme />
        </div>
      </header>
      <main id="main">
        {r ? <Page key={rid} r={r} /> : <section className="sec hero"><div className="wrap"><p className="muted">{t('Loading the region', 'Загружаем регион')}</p></div></section>}
      </main>
      <footer className="foot">
        <div className="wrap foot-in">
          <span>{t('Weather', 'Погода')}: NASA POWER. {t('Soil', 'Почва')}: ISRIC SoilGrids 2.0. {t('Layers', 'Слои')}: NASA GIBS (MODIS, SMAP, GPM IMERG, GRACE-FO). {t('Imagery', 'Снимки')}: Esri, Maxar.</span>
          <span>NASA Space Apps 2026 · Adapting farms with NASA data</span>
        </div>
      </footer>
    </LangCtx.Provider>
  )
}

// one button cycles auto -> light -> dark; the head script applies the stored choice before paint
type Mode = 'auto' | 'light' | 'dark'
function Theme() {
  const t = useT()
  const [m, setM] = useState<Mode>(() => (stored('theme') as Mode) || 'auto')
  useEffect(() => {
    const el = document.documentElement
    if (m === 'auto') delete el.dataset.theme
    else el.dataset.theme = m
    store('theme', m)
  }, [m])
  const label = { auto: t('Auto', 'Авто'), light: t('Light', 'Светлая'), dark: t('Dark', 'Тёмная') }[m]
  return (
    <button className="theme" onClick={() => setM(({ auto: 'light', light: 'dark', dark: 'auto' } as const)[m])}
      aria-label={`${t('Theme', 'Тема')}: ${label}`} title={`${t('Theme', 'Тема')}: ${label}`}>
      <span className={`theme-i theme-${m}`} aria-hidden />{label}
    </button>
  )
}

function Page({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const ref = r.strategies
  const cur = ref[0]
  const [selected, setSelected] = useState(r.rep_cell)
  const [sid, setSid] = useState('current')
  const [metric, setMetric] = useState<MetricKey>('profit')
  const [layer, setLayer] = useState<NasaLayer>('ndvi')
  const cell = r.cells.find((c) => c.h3 === selected)!
  const best = [...ref].sort((a, b) => b.metrics.profit[1] - a.metrics.profit[1])[0]
  const bestCut = Math.round((1 - best.metrics.erosion / Math.max(cur.metrics.erosion, 0.01)) * 100)
  const metricKeys = (Object.keys(METRICS) as MetricKey[]).filter((k) => k !== 'irr' || r.irrigated)
  const n = r.years[1] - r.years[0] + 1
  const cellNo = r.cells.findIndex((c) => c.h3 === selected) + 1

  return (
    <>
      <section className="sec hero" id="top" data-enter>
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">{rname(r, l)}</p>
            <h1 className="h-xl">{t('Crop rotation planner for dry farms, built on NASA data', 'Планировщик севооборотов для засушливых хозяйств на данных NASA')}</h1>
            <p className="lead">
              {t(`Profit, soil loss, soil carbon${r.irrigated ? ' and water' : ''} for each rotation, replayed over ${n} real seasons (${r.years[0]}–${r.years[1]}).`,
                `Прибыль, потеря почвы, углерод${r.irrigated ? ' и вода' : ''} для каждого севооборота на ${n} реальных сезонах (${r.years[0]}–${r.years[1]}).`)}
            </p>
            <div className="actions">
              <a className="btn btn-solid" href="#map">{t('Open the field map', 'Открыть карту полей')}</a>
              <a className="btn btn-ghost" href="#report">{t('Download the report', 'Скачать отчёт')}</a>
            </div>
          </div>
          <div className="panel hero-card" aria-label={t('Reference field summary', 'Опорное поле, сводка')}>
            <span className="label">{t('Model result on the reference field', 'Результат модели на опорном поле')}</span>
            <p className="verdict">
              <strong>{usd(best.metrics.profit[1])}</strong> {t('per hectare a year instead of', 'с гектара в год вместо')} {usd(cur.metrics.profit[1])}
            </p>
            <p className="small muted">
              {t(`${sname(best, l)}. Soil loss ${Math.abs(bestCut)}% ${bestCut >= 0 ? 'lower' : 'higher'} than now.`, `${sname(best, l)}. Эрозия на ${Math.abs(bestCut)}% ${bestCut >= 0 ? 'ниже' : 'выше'}, чем сейчас.`)}
            </p>
            {ref.map((s) => (
              <div className="hero-row" key={s.id}>
                <span className="dot" style={{ background: SC[s.id] }} />
                <span className="hero-name">{short(s, l)}</span>
                <span className="hero-bar"><i style={{ width: `${Math.max(2, (s.metrics.profit[1] / Math.max(...ref.map((x) => x.metrics.profit[1]))) * 100)}%`, background: SC[s.id] }} /></span>
                <span className="mono">{usd(s.metrics.profit[1])}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="wrap steps">
          {([
            ['#map', t('Pick a field', 'Выберите поле'), t('NASA layers and soil for each cell', 'Слои NASA и почва по каждой ячейке')],
            ['#strategies', t('Compare rotations', 'Сравните севообороты'), t(`Profit as a range over ${n} years`, `Прибыль диапазоном за ${n} лет`)],
            ['#time', t('Stress-test', 'Проверьте на прочность'), t('Worst years and a +2 °C climate', 'Худшие годы и климат +2 °C')],
            ['#tradeoffs', t('Decide', 'Решите'), t('Trade-offs, carbon, PDF report', 'Компромиссы, углерод, отчёт PDF')],
          ] as const).map(([href, title, sub], k) => (
            <a key={href} href={href} className="step-card">
              <span className="step">{k + 1}</span>
              <span><strong>{title}</strong><span className="small muted">{sub}</span></span>
            </a>
          ))}
        </div>
      </section>

      <section className="sec" id="map">
        <div className="wrap">
          <SecHead n="1" title={t('Field map with NASA layers', 'Карта полей со слоями NASA')} sub={t('Click a cell to see its soil and how each rotation does there.', 'Нажмите на ячейку: её почва и результат каждого севооборота.')} />
          <div className="map-grid">
            <MapView region={r} strategy={sid} metric={metric} layer={layer} selected={selected} onSelect={setSelected} />
            <div className="panel side">
              <Field label={t('Strategy on the map', 'Стратегия на карте')}>
                <select value={sid} onChange={(e) => setSid(e.target.value)}>
                  {ref.map((s) => <option key={s.id} value={s.id}>{sname(s, l)}</option>)}
                </select>
              </Field>
              <Field label={t('Colour cells by', 'Цвет ячеек')}>
                <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
                  {metricKeys.map((k) => <option key={k} value={k}>{METRICS[k][l === 'ru' ? 1 : 0]}</option>)}
                </select>
              </Field>
              <Field label={t('NASA layer', 'Слой NASA')}>
                <select value={layer} onChange={(e) => setLayer(e.target.value as NasaLayer)}>
                  {Object.entries(NASA_LAYERS).map(([k, v]) => <option key={k} value={k}>{l === 'ru' ? v.ru : v.label}</option>)}
                </select>
              </Field>
              <div className="legend-ramp"><span>{t('worse', 'хуже')}</span><i /><span>{t('better', 'лучше')}</span></div>
              <h3 className="h-sm">{selected === r.rep_cell ? t('Reference field', 'Опорное поле') : t(`Field cell ${cellNo} of ${r.cells.length}`, `Ячейка ${cellNo} из ${r.cells.length}`)}</h3>
              <p className="small muted mono">
                {t('clay', 'глина')} {cell.soil.clay.toFixed(0)}% · {t('sand', 'песок')} {cell.soil.sand.toFixed(0)}% · SOC {cell.soil.soc.toFixed(1)} {t('g/kg', 'г/кг')}
              </p>
              <a className="ml-box" href="#ml">
                <span className="badge">ML</span>
                {r.ml?.cells[selected]
                  ? <span>{t('Crop now', 'Культура сейчас')}: <strong>{r.ml.cells[selected].crop}</strong> ({Math.round((r.ml.cells[selected].crop_p ?? 0) * 100)}%){r.ml.cells[selected].sm_rootzone != null && <> · {t('soil moisture', 'влага')} {r.ml.cells[selected].sm_rootzone}</>}</span>
                  : <span className="muted">{t('Crop map and field-scale moisture: model not connected', 'Карта культур и влага поля: модель не подключена')}</span>}
              </a>
              <table className="tbl">
                <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Profit P10–P90', 'Прибыль P10–P90')}</th><th>{t('Soil loss', 'Эрозия')}</th></tr></thead>
                <tbody>
                  {ref.map((s) => {
                    const m = cell.s[s.id]
                    return (
                      <tr key={s.id} aria-selected={s.id === sid} onClick={() => setSid(s.id)}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                        <td className="mono">{usd(m.profit[0])}…{usd(m.profit[2])}</td>
                        <td className="mono">{m.erosion}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="strategies">
        <div className="wrap">
          <SecHead n="2" title={t('Four rotations to test with your agronomist', 'Четыре севооборота для проверки с агрономом')} sub={t('Current practice against three alternatives. Hypotheses with assumed prices, not advice.', 'Текущая практика против трёх альтернатив. Гипотезы с допущенными ценами, не советы.')} />
          <div className="cards">
            {ref.map((s) => <StrategyCard key={s.id} r={r} s={s} />)}
          </div>
        </div>
      </section>

      <TimeMachine r={r} />
      <Twin r={r} />
      <Tradeoffs r={r} />
      <CarbonWater r={r} />
      <MlSection r={r} />
      <Report r={r} />
      <Method r={r} />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span className="label">{label}</span>{children}</label>
}

function Rotation({ r, s }: { r: Region; s: { rotation: string[] } }) {
  const l = useLang()
  return (
    <span className="rot">
      {s.rotation.map((c, i) => <span key={i} className={`crop crop-${r.crops[c].family}`}>{cropShort(r, c, l)}</span>)}
    </span>
  )
}

function BandBar({ band, lo, hi }: { band: [number, number, number]; lo: number; hi: number }) {
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="band" aria-hidden>
      <i style={{ left: x(band[0]), width: `calc(${x(band[2])} - ${x(band[0])})` }} />
      <b style={{ left: x(band[1]) }} />
      {lo < 0 && <em style={{ left: x(0) }} />}
    </div>
  )
}

const irrName = (i: string | undefined, t: (a: string, b: string) => string) => (i ? `, ${i === 'drip' ? t('drip', 'капельный') : t('flood', 'напуск')}` : '')

function StrategyCard({ r, s }: { r: Region; s: Strategy }) {
  const l = useLang(), t = useT()
  const all = r.strategies.flatMap((x) => x.metrics.profit)
  const lo = Math.min(0, ...all), hi = Math.max(...all)
  const m = s.metrics
  return (
    <article className="panel card" style={{ borderTopColor: SC[s.id] }}>
      <h3 className="h-sm">{sname(s, l)}</h3>
      <Rotation r={r} s={s} />
      <div className="kv">
        <span className="label">{t('Profit per ha: bad · median · good year', 'Прибыль на га: плохой · медиана · хороший год')}</span>
        <BandBar band={m.profit} lo={lo} hi={hi} />
        <span className="mono">{usd(m.profit[0])} · <strong>{usd(m.profit[1])}</strong> · {usd(m.profit[2])}</span>
      </div>
      <dl className="stats">
        <div><dt>{t('Soil loss, t/ha', 'Эрозия, т/га')}</dt><dd className="mono">{m.erosion}</dd></div>
        <div><dt>{t('Carbon, t/ha', 'Углерод, т/га')}</dt><dd className="mono">{m.dsoc > 0 ? '+' : ''}{m.dsoc}</dd></div>
        {r.irrigated
          ? <div><dt>{t('Pumped, mm', 'Откачка, мм')}</dt><dd className="mono">{Math.round(m.irr[1])}</dd></div>
          : <div><dt>{t('Loss years', 'Убыточных лет')}</dt><dd className="mono">{Math.round(m.loss_years * 100)}%</dd></div>}
      </dl>
      <details className="more">
        <summary>{t('Idea, risk and details', 'Идея, риск и детали')}</summary>
        <p className="small">{(l === 'ru' && s.idea_ru) || s.idea}</p>
        <p className="small risk">{(l === 'ru' && s.risk_ru) || s.risk}</p>
        <p className="small muted">
          {s.notill ? 'No-till' : t('Tilled', 'Вспашка')}{irrName(s.irrigation, t)} · {t('bare days', 'голых дней')} {m.bare_days}
          {r.irrigated && <> · {t('loss years', 'убыточных лет')} {Math.round(m.loss_years * 100)}%</>}
        </p>
      </details>
    </article>
  )
}

function TimeMachine({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const years = r.strategies[0].timeline.map((x) => x.year)
  const [year, setYear] = useState(() => [...r.strategies[0].timeline].sort((a, b) => a.profit[1] - b.profit[1])[0].year) // opens on the worst year
  const [show, setShow] = useState<string[]>(r.strategies.map((s) => s.id))
  const rows = years.map((y) => {
    const o: Record<string, number | [number, number]> = { year: y }
    for (const s of r.strategies) {
      const x = s.timeline.find((z) => z.year === y)
      if (!x) continue
      o[s.id] = x.profit[1]
      o[s.id + '_band'] = [x.profit[0], x.profit[2]]
    }
    return o
  })
  const dek = r.strategies.map((s) => s.dekads.filter((d) => d[0].startsWith(String(year))))
  const dekRows = dek[0].map((d, i) => {
    const o: Record<string, number | string> = { date: d[0].slice(5) }
    r.strategies.forEach((s, j) => (o[s.id] = dek[j][i]?.[1] ?? 0))
    return o
  })
  const shown = r.strategies.filter((s) => show.includes(s.id))

  return (
    <section className="sec" id="time">
      <div className="wrap">
        <SecHead n="3" title={t(`Time machine: every season since ${years[0]}`, `Машина времени: каждый сезон с ${years[0]}`)} sub={t('Drag the year: what each rotation would have earned in that weather.', 'Двигайте год: сколько дал бы каждый севооборот в ту погоду.')} />
        <div className="row-between filters">
          <div className="chips" role="group" aria-label={t('Strategies shown', 'Показать стратегии')}>
            {r.strategies.map((s) => (
              <button key={s.id} className="chip" aria-pressed={show.includes(s.id)}
                onClick={() => setShow((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>
                <span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}
              </button>
            ))}
          </div>
          <label className="field inline">
            <span className="label">{t('Year', 'Год')} {year}</span>
            <input type="range" min={years[0]} max={years[years.length - 1]} value={year} onChange={(e) => setYear(+e.target.value)} />
          </label>
        </div>
        <div className="two">
          <div className="panel chart">
            <h3 className="h-sm">{t('Profit per hectare by harvest year', 'Прибыль на гектар по годам урожая')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={rows} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.4} />
                <ReferenceLine x={year} stroke="var(--ink)" strokeDasharray="3 3" />
                <Tooltip formatter={(v) => (Array.isArray(v) ? `${usd(+v[0])} … ${usd(+v[1])}` : usd(Number(v)))} />
                {shown.map((s) => (
                  <Area key={s.id + 'b'} dataKey={s.id + '_band'} stroke="none" fill={SC[s.id]} fillOpacity={0.1} isAnimationActive={false} legendType="none" name={`${short(s, l)} ${t('range', 'разброс')}`} />
                ))}
                {shown.map((s) => (
                  <Line key={s.id} dataKey={s.id} stroke={SC[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} name={short(s, l)}
                    label={(p: { index?: number; x?: number | string; y?: number | string }) => p.index === rows.length - 1 ? <text x={Number(p.x ?? 0) + 6} y={Number(p.y ?? 0) + 4} fontSize={11} fill="var(--ink)">{s.id === 'current' ? t('Now', 'Сейчас') : s.id}</text> : <g />} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <p className="small muted">{t('Line: median. Shade: spread over rotation start years.', 'Линия — медиана. Тень — разброс по году старта севооборота.')}</p>
          </div>
          <div className="panel chart">
            <h3 className="h-sm">{t(`Soil water in ${year}, mm in the root zone`, `Влага почвы в ${year}, мм в корневой зоне`)}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={dekRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted)" interval={5} />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" width={40} />
                <Tooltip />
                {shown.map((s) => (
                  <Line key={s.id} dataKey={s.id} stroke={SC[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} name={short(s, l)} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <table className="tbl">
              <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t(`Harvest ${year}`, `Урожай ${year}`)}</th><th>{t('Profit', 'Прибыль')}</th>{r.irrigated && <th>{t('Pumped', 'Откачка')}</th>}</tr></thead>
              <tbody>
                {shown.map((s) => {
                  const x = s.timeline.find((z) => z.year === year)
                  return (
                    <tr key={s.id}>
                      <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                      <td>{x?.crops.map((c) => `${cropShort(r, c.crop, l)}${c.yield_t ? ` ${c.yield_t} ${t('t', 'т')}` : ''}`).join(', ') || t('no harvest', 'без урожая')}</td>
                      <td className="mono">{x ? usd(x.profit[1]) : '–'}</td>
                      {r.irrigated && <td className="mono">{x ? Math.round(x.irr) : 0} {t('mm', 'мм')}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function Twin({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const [i, setI] = useState(2)
  const [j, setJ] = useState(1)
  const dT = r.twin.dT[i], dP = r.twin.dP[j]
  const rows = r.strategies.map((s) => {
    const g = r.twin.grid[s.id][i][j], base = r.twin.grid[s.id][0][2]
    return { id: s.id, name: short(s, l), p50: g.profit[1], err: [g.profit[1] - g.profit[0], g.profit[2] - g.profit[1]], base: base.profit[1], loss: g.loss_years, erosion: g.erosion, irr: g.irr }
  })
  return (
    <section className="sec" id="twin">
      <div className="wrap">
        <SecHead n="4" title={t('Climate twin: the same field, warmer and drier', 'Климатический двойник: то же поле, теплее и суше')} sub={t('Historical weather shifted by a temperature and rainfall change. A scenario, not a forecast.', 'Историческая погода, сдвинутая по температуре и осадкам. Сценарий, а не прогноз.')} />
        <div className="two">
          <div className="panel">
            <Field label={`${t('Warming', 'Потепление')}: +${dT} °C`}>
              <input type="range" min={0} max={r.twin.dT.length - 1} value={i} onChange={(e) => setI(+e.target.value)} />
            </Field>
            <Field label={`${t('Rainfall', 'Осадки')}: ${dP >= 0 ? '+' : ''}${Math.round(dP * 100)}%`}>
              <input type="range" min={0} max={r.twin.dP.length - 1} value={j} onChange={(e) => setJ(+e.target.value)} />
            </Field>
            <table className="tbl">
              <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Median profit', 'Медиана')}</th><th>{t('vs today', 'к сегодня')}</th><th>{t('Loss years', 'Убыточных лет')}</th><th>{t('Soil loss', 'Эрозия')}</th>{r.irrigated && <th>{t('Pumped', 'Откачка')}</th>}</tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td><span className="dot" style={{ background: SC[x.id] }} />{x.name}</td>
                    <td className="mono">{usd(x.p50)}</td>
                    <td className="mono">{usd(x.p50 - x.base)}</td>
                    <td className="mono">{Math.round(x.loss * 100)}%</td>
                    <td className="mono">{x.erosion} {t('t', 'т')}</td>
                    {r.irrigated && <td className="mono">{Math.round(x.irr)} {t('mm', 'мм')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel chart">
            <h3 className="h-sm">{t('Median profit per hectare, with the 1-in-10 range', 'Медианная прибыль на га и разброс 1 из 10 лет')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.4} />
                <Tooltip formatter={(v) => usd(Number(v))} />
                <Bar dataKey="p50" name={t('Median profit', 'Медианная прибыль')} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {rows.map((x) => <RCell key={x.id} fill={SC[x.id]} />)}
                  <ErrorBar dataKey="err" width={8} stroke="var(--ink)" strokeWidth={1.5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

function Tradeoffs({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const maxE = Math.max(...r.cloud.map((c) => c.metrics.erosion))
  const [eCap, setECap] = useState(maxE)
  const [worst, setWorst] = useState(Math.min(...r.cloud.map((c) => c.metrics.profit[0])))
  const ok = (p: (typeof r.cloud)[number]) => p.metrics.erosion <= eCap + 1e-9 && p.metrics.profit[0] >= worst
  const label = (p: { rotation: string[]; notill: boolean; irrigation?: string }) =>
    p.rotation.map((c) => cropShort(r, c, l)).join(' → ') + (p.notill ? ', no-till' : t(', tilled', ', вспашка')) + irrName(p.irrigation, t)
  const pt = (p: (typeof r.cloud)[number]) => ({ x: p.metrics.erosion, y: p.metrics.profit[1], z: p.metrics.dsoc, name: label(p), p10: p.metrics.profit[0] })
  const front = useMemo(() => r.pareto.filter(ok).sort((a, b) => b.metrics.profit[1] - a.metrics.profit[1]), [r, eCap, worst]) // eslint-disable-line react-hooks/exhaustive-deps
  const minWorst = Math.min(...r.cloud.map((c) => c.metrics.profit[0])), maxWorst = Math.max(...r.cloud.map((c) => c.metrics.profit[0]))

  return (
    <section className="sec" id="tradeoffs">
      <div className="wrap">
        <SecHead n="5" title={t(`Trade-offs: ${r.pareto.length} rotations nothing beats on every count`, `Компромиссы: ${r.pareto.length} севооборотов, которые никто не обходит по всем пунктам`)} sub={t(`NSGA-II searched ${r.cloud.length} rotations. Set your limits; the list keeps what fits.`, `NSGA-II перебрал ${r.cloud.length} севооборотов. Задайте ограничения — останется подходящее.`)} />
        <div className="row-between filters">
          <label className="field inline"><span className="label">{t('Soil loss at most', 'Эрозия не больше')} {eCap.toFixed(2)} {t('t/ha', 'т/га')}</span>
            <input type="range" min={0} max={maxE} step={maxE / 100} value={eCap} onChange={(e) => setECap(+e.target.value)} /></label>
          <label className="field inline"><span className="label">{t('Bad-year profit at least', 'Прибыль в плохой год не меньше')} {usd(worst)}</span>
            <input type="range" min={minWorst} max={maxWorst} step={(maxWorst - minWorst) / 100} value={worst} onChange={(e) => setWorst(+e.target.value)} /></label>
        </div>
        <div className="two">
          <div className="panel chart">
            <h3 className="h-sm">{t('Median profit against soil loss', 'Медианная прибыль против эрозии')}</h3>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis type="number" dataKey="x" unit={t(' t', ' т')} domain={[0, 'dataMax']} tickFormatter={(v) => (+v).toFixed(1)} tick={{ fontSize: 12 }} stroke="var(--muted)" label={{ value: t('Soil loss, t/ha a year', 'Эрозия, т/га в год'), position: 'insideBottom', offset: -8, fontSize: 12 }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ZAxis range={[40, 40]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const d = payload?.[0]?.payload
                  return d ? <div className="tip"><strong>{d.name}</strong><br />{t('median', 'медиана')} {usd(d.y)}, {t('bad year', 'плохой год')} {usd(d.p10)}<br />{t('soil loss', 'эрозия')} {d.x} {t('t', 'т')}, ΔC {d.z > 0 ? '+' : ''}{d.z}</div> : null
                }} />
                <Scatter data={r.cloud.filter((c) => !ok(c)).map(pt)} fill="var(--grid-strong)" isAnimationActive={false} />
                <Scatter data={r.cloud.filter(ok).map(pt)} fill="var(--muted)" isAnimationActive={false} />
                <Scatter data={front.map(pt)} fill="var(--ink)" isAnimationActive={false} />
                {r.strategies.map((s) => (
                  <Scatter key={s.id} data={[{ ...pt(s), name: sname(s, l) }]} fill={SC[s.id]} shape="diamond" isAnimationActive={false}
                    label={{ dataKey: () => (s.id === 'current' ? t('Now', 'Сейчас') : s.id), position: 'right', fontSize: 12, fill: 'var(--ink)' }} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            <div className="legend">
              <span><i style={{ background: 'var(--grid-strong)' }} />{t('Searched', 'Перебрано')}</span>
              <span><i style={{ background: 'var(--muted)' }} />{t('Fits your limits', 'В ваших рамках')}</span>
              <span><i style={{ background: 'var(--ink)' }} />{t('Best trade-offs', 'Лучшие компромиссы')}</span>
              <span>◆ {t('the four strategies', 'четыре стратегии')}</span>
            </div>
          </div>
          <div className="panel list">
            <h3 className="h-sm">{t(`${front.length} best trade-offs inside your limits`, `${front.length} лучших компромиссов в ваших рамках`)}</h3>
            <table className="tbl">
              <thead><tr><th>{t('Rotation', 'Севооборот')}</th><th>{t('Median', 'Медиана')}</th><th>{t('Bad year', 'Плохой год')}</th><th>{t('Soil loss', 'Эрозия')}</th><th>ΔC</th>{r.irrigated && <th>{t('Pumped', 'Откачка')}</th>}</tr></thead>
              <tbody>
                {front.slice(0, 8).map((p, k) => (
                  <tr key={k}>
                    <td>{label(p)}</td>
                    <td className="mono">{usd(p.metrics.profit[1])}</td>
                    <td className="mono">{usd(p.metrics.profit[0])}</td>
                    <td className="mono">{p.metrics.erosion}</td>
                    <td className="mono">{p.metrics.dsoc > 0 ? '+' : ''}{p.metrics.dsoc}</td>
                    {r.irrigated && <td className="mono">{Math.round(p.metrics.irr[1])}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!front.length && <p className="small muted">{t('Nothing fits both limits. Loosen one of them.', 'Под оба ограничения ничего не подходит. Ослабьте одно.')}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function CarbonWater({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const [area, setArea] = useState(1000)
  return (
    <section className="sec" id="carbon">
      <div className="wrap">
        <SecHead n="6" title={t('Carbon credits and the water budget', 'Углеродные кредиты и водный баланс')} sub={t('Extra income and saved resources for a farm of your size.', 'Дополнительный доход и сбережённые ресурсы для хозяйства вашего размера.')} />
        <label className="field inline filters"><span className="label">{t('Farm size', 'Площадь хозяйства')}: {area.toLocaleString('en-US')} {t('ha', 'га')}</span>
          <input type="range" min={100} max={20000} step={100} value={area} onChange={(e) => setArea(+e.target.value)} /></label>
        <div className="two">
          <div className="panel">
            <h3 className="h-sm">{t('Soil-carbon credits against current practice', 'Кредиты за почвенный углерод к текущей практике')}</h3>
            <table className="tbl">
              <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('t CO2e/ha a year', 'т CO2e/га в год')}</th><th>$/{t('ha a year', 'га в год')}</th><th>{t('Farm, $ a year', 'Хозяйство, $ в год')}</th></tr></thead>
              <tbody>
                {r.strategies.slice(1).map((s) => (
                  <tr key={s.id}>
                    <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                    <td className="mono">{s.carbon.t_co2_ha_yr}</td>
                    <td className="mono">{usd(s.carbon.usd_ha_yr[0])}…{usd(s.carbon.usd_ha_yr[1])}</td>
                    <td className="mono">{usd(s.carbon.usd_ha_yr[0] * area)}…{usd(s.carbon.usd_ha_yr[1] * area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">
              {t(`RothC-26.3, ${Math.round(r.assumptions.buffer * 100)}% buffer, $${r.assumptions.co2_price[0]}–${r.assumptions.co2_price[1]}/t. Paid only after soil sampling and a registry audit: an upper bound, not income.`,
                `RothC-26.3, буфер ${Math.round(r.assumptions.buffer * 100)}%, $${r.assumptions.co2_price[0]}–${r.assumptions.co2_price[1]}/т. Платят только после отбора проб и аудита реестра: верхняя оценка, не доход.`)}
            </p>
          </div>
          <div className="panel">
            {r.irrigated ? (
              <>
                <h3 className="h-sm">{t('Groundwater left in the aquifer', 'Вода, оставленная в водоносном слое')}</h3>
                <table className="tbl">
                  <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Pumped, mm', 'Откачка, мм')}</th><th>{t('Saved, m³/ha', 'Сэкономлено, м³/га')}</th><th>{t('Farm, acre-feet', 'Хозяйство, акр-футы')}</th></tr></thead>
                  <tbody>
                    {r.strategies.map((s) => (
                      <tr key={s.id}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                        <td className="mono">{Math.round(s.metrics.irr[1])}</td>
                        <td className="mono">{Math.round(s.water_saved_mm * 10).toLocaleString('en-US')}</td>
                        <td className="mono">{Math.round((s.water_saved_mm * 10 * area) / 1233.5).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">{t('GRACE-FO on the map shows the basin losing stored water; it cannot see one farm.', 'GRACE-FO на карте показывает потерю запасов воды бассейном; одно хозяйство он не видит.')}</p>
              </>
            ) : (
              <>
                <h3 className="h-sm">{t('Bare soil on a rain-fed field', 'Голая почва на богаре')}</h3>
                <table className="tbl">
                  <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Bare days a year', 'Голых дней в году')}</th><th>{t('Soil loss, t/ha', 'Эрозия, т/га')}</th><th>{t('Farm, t of soil a year', 'Хозяйство, т почвы в год')}</th></tr></thead>
                  <tbody>
                    {r.strategies.map((s) => (
                      <tr key={s.id}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                        <td className="mono">{s.metrics.bare_days}</td>
                        <td className="mono">{s.metrics.erosion}</td>
                        <td className="mono">{Math.round(s.metrics.erosion * area).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">{t('No pumping here: the water question is moisture stored before sowing.', 'Полива нет: вопрос воды — это влага, накопленная к посеву.')}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Method({ r }: { r: Region }) {
  const t = useT()
  return (
    <section className="sec" id="method">
      <div className="wrap">
        <SecHead n="9" title={t('Method and limits', 'Метод и ограничения')} />
        <div className="three">
          <div className="panel">
            <h3 className="h-sm">{t('Data', 'Данные')}</h3>
            <ul className="list-plain small">
              <li><strong>NASA POWER</strong> {t('daily weather', 'суточная погода')}, {r.years[0] - 1}–{r.years[1] + 1}</li>
              <li><strong>SoilGrids 2.0</strong> {t('soil, 0–30 cm', 'почва, 0–30 см')}</li>
              <li><strong>NASA GIBS</strong> MODIS, SMAP, IMERG, GRACE-FO</li>
              {r.ml && <li><strong>ML</strong> {r.ml.model}</li>}
            </ul>
          </div>
          <div className="panel">
            <h3 className="h-sm">{t('Models', 'Модели')}</h3>
            <ul className="list-plain small">
              <li>{t('FAO-56 water balance, FAO-33 yield', 'Водный баланс FAO-56, урожай FAO-33')}</li>
              <li>{t('RWEQ wind and RUSLE water erosion', 'Ветровая RWEQ и водная RUSLE эрозия')}</li>
              <li>{t('RothC-26.3 soil carbon', 'Почвенный углерод RothC-26.3')}</li>
              <li>{t('NSGA-II search (pymoo)', 'Поиск NSGA-II (pymoo)')}</li>
            </ul>
          </div>
          <div className="panel">
            <h3 className="h-sm">{t('What it will not tell you', 'Чего инструмент не скажет')}</h3>
            <ul className="list-plain small">
              <li>{t('A yield promise: every number is a range.', 'Обещание урожая: каждое число — диапазон.')}</li>
              <li>{t('What to plant: you and your agronomist decide.', 'Что сеять: решаете вы и агроном.')}</li>
              <li>{t('Absolute soil loss: values compare rotations.', 'Абсолютную эрозию: числа сравнивают севообороты.')}</li>
            </ul>
          </div>
        </div>
        <div className="panel chart">
          <h3 className="h-sm">{t('Climate of the reference field, NASA POWER monthly means', 'Климат опорного поля, средние NASA POWER по месяцам')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={r.climate} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(m) => t('JFMAMJJASOND', 'ЯФМАМИИАСОНД')[m - 1]} tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" unit={t(' mm', ' мм')} width={60} />
              <Tooltip />
              <Bar dataKey="rain" name={t('Rain, mm', 'Осадки, мм')} fill={SC.current} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="et0" name={t('Reference ET, mm', 'Испаряемость, мм')} fill={SC.A} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend"><span><i style={{ background: SC.current }} />{t('Rain', 'Осадки')}</span><span><i style={{ background: SC.A }} />{t('Reference evapotranspiration', 'Эталонная испаряемость')}</span></div>
        </div>
      </div>
    </section>
  )
}

function MlSection({ r }: { r: Region }) {
  const t = useT()
  const n = r.ml ? Object.keys(r.ml.cells).length : 0
  return (
    <section className="sec" id="ml">
      <div className="wrap">
        <SecHead n="7" title={t('ML layers: what grows now and field-scale moisture', 'ML-слои: что растёт сейчас и влага в масштабе поля')}
          sub={t('Satellites see the district; ML brings it down to the field. Results appear in the map panel when you click a cell.', 'Спутник видит район, ML доводит до поля. Результат виден в панели карты при клике на ячейку.')} />
        <div className="two ml-grid">
          <div className="panel">
            <div className="row-between"><h3 className="h-sm">{t('Crop map', 'Карта культур')}</h3><span className={`status ${r.ml ? 'on' : ''}`}>{r.ml ? t('Connected', 'Подключено') : t('Not connected', 'Не подключено')}</span></div>
            <p className="small muted">{t('Classifies the current crop of each cell from HLS / MODIS time series, so "current practice" comes from the field, not a guess.', 'Определяет текущую культуру ячейки по рядам HLS / MODIS, чтобы «текущая практика» бралась с поля, а не из догадки.')}</p>
          </div>
          <div className="panel">
            <div className="row-between"><h3 className="h-sm">{t('Soil moisture downscaling', 'Детализация влаги почвы')}</h3><span className={`status ${r.ml ? 'on' : ''}`}>{r.ml ? t('Connected', 'Подключено') : t('Not connected', 'Не подключено')}</span></div>
            <p className="small muted">{t('SMAP pixels are 9 km wide. The model sharpens root-zone moisture to the cell, with a prediction interval.', 'Пиксель SMAP — 9 км. Модель уточняет влагу корневой зоны до ячейки, с интервалом предсказания.')}</p>
          </div>
        </div>
        <p className="small muted note">
          {r.ml
            ? `${r.ml.model} ${r.ml.version} · ${n} ${t('cells', 'ячеек')} · ${r.ml.validation}`
            : t(`The models live in a separate repository. Put its output in data/ml/${r.id}.json and rebuild: the map picks it up.`, `Модели живут в отдельном репозитории. Положите их вывод в data/ml/${r.id}.json и пересоберите: карта подхватит.`)}
        </p>
      </div>
    </section>
  )
}
