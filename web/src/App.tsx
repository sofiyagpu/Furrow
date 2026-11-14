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
import { SC, usd, short, sname, cropShort, rname, mlCrop, mlText, mlCells, mlHas, mlDetail, mlValidation, months, LangCtx, useLang, useT, type Lang } from './fmt'

const METRICS: Record<MetricKey, [string, string]> = {
  profit: ['Median profit, $/ha', 'Медианная прибыль, $/га'],
  erosion: ['Soil loss, t/ha a year', 'Потеря почвы, т/га в год'],
  dsoc: ['Soil carbon change, t C/ha a year', 'Изменение углерода, т C/га в год'],
  irr: ['Pumped water, mm a year', 'Откачка воды, мм в год'],
}

const stored = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const store = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode: lasts this visit */ } }

const METRIC_SHORT: Record<MetricKey, [string, string]> = { profit: ['Profit', 'Прибыль'], erosion: ['Soil loss', 'Эрозия'], dsoc: ['Carbon', 'Углерод'], irr: ['Water', 'Вода'] }

// app shell after soilink: menu on the left, one view at a time, the map view fills the screen
type View = 'map' | 'strategies' | 'time' | 'climate' | 'tradeoffs' | 'carbon' | 'ml' | 'report' | 'method'
const VIEWS: [View, string, string][] = [
  ['map', 'Field map', 'Карта полей'],
  ['strategies', 'Strategies', 'Стратегии'],
  ['time', 'Time machine', 'По годам'],
  ['climate', 'Climate', 'Климат'],
  ['tradeoffs', 'Trade-offs', 'Компромиссы'],
  ['carbon', 'Carbon and water', 'Углерод и вода'],
  ['ml', 'ML layers', 'ML-слои'],
  ['report', 'Report', 'Отчёт'],
  ['method', 'Method and data', 'Метод и данные'],
]
const viewFromHash = (): View => {
  const h = location.hash.replace('#', '') as View
  return VIEWS.some(([v]) => v === h) ? h : 'map'
}

export default function App() {
  // Arizona first: it carries the ML crop map; ?r=vko opens Kazakhstan
  const [rid, setRid] = useState<'vko' | 'az'>(() => (new URLSearchParams(location.search).get('r') === 'vko' ? 'vko' : 'az'))
  const [lang, setLang] = useState<Lang>(() => (stored('lang') ?? (navigator.language.startsWith('ru') ? 'ru' : 'en')) as Lang)
  const [view, setView] = useState<View>(viewFromHash)
  const [data, setData] = useState<Record<string, Region>>({})
  const r = data[rid]
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const title = VIEWS.find(([v]) => v === view)!

  useEffect(() => {
    if (data[rid]) return
    fetch(`${import.meta.env.BASE_URL}data/${rid}.json`).then((x) => x.json()).then((d) => setData((o) => ({ ...o, [rid]: d })))
  }, [rid, data])
  useEffect(() => { document.documentElement.lang = lang; store('lang', lang) }, [lang])
  useEffect(() => {
    const on = () => setView(viewFromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { document.querySelector('.content')?.scrollTo(0, 0) }, [view])

  const nav = VIEWS.map(([v, en, ru], i) => (
    <a key={v} href={`#${v}`} aria-current={view === v ? 'page' : undefined}><span className="nav-n">{String(i + 1).padStart(2, '0')}</span>{t(en, ru)}</a>
  ))
  const regionSeg = (
    <div className="seg" role="group" aria-label={t('Region', 'Регион')}>
      <button aria-pressed={rid === 'vko'} onClick={() => setRid('vko')}>{t('Kazakhstan', 'ВКО')}</button>
      <button aria-pressed={rid === 'az'} onClick={() => setRid('az')}>{t('Arizona', 'Аризона')}</button>
    </div>
  )
  const langSeg = (
    <div className="seg" role="group" aria-label={t('Language', 'Язык')}>
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
      <button aria-pressed={lang === 'ru'} onClick={() => setLang('ru')} lang="ru">RU</button>
    </div>
  )

  return (
    <LangCtx.Provider value={lang}>
      <a className="skip" href="#main">{t('Skip to content', 'К содержанию')}</a>
      <div className="app">
        <aside className="rail">
          <a href="#map" className="mark" aria-label="Furrow"><span className="mark-i" aria-hidden />Furrow</a>
          <p className="rail-sub">{t('Crop rotation planner on NASA data', 'Планировщик севооборотов на данных NASA')}</p>
          <nav aria-label={t('Sections', 'Разделы')} className="rail-nav">{nav}</nav>
          <div className="rail-foot">
            <span className="label">{t('Region', 'Регион')}</span>
            {regionSeg}
            <span className="label">{t('Language', 'Язык')}</span>
            {langSeg}
            <p className="rail-src">NASA POWER · SMAP · GPM IMERG · GIBS · SoilGrids</p>
          </div>
        </aside>
        <div className="main">
          <header className="top">
            <div className="top-title">
              <h1>{t(title[1], title[2])}</h1>
              {r && <span className="top-region">{rname(r, lang)}</span>}
            </div>
            {/* narrow screens: one native select instead of a sideways-scrolling tab strip */}
            <select className="msel" aria-label={t('Section', 'Раздел')} value={view} onChange={(e) => { location.hash = e.target.value }}>
              {VIEWS.map(([v, en, ru]) => <option key={v} value={v}>{t(en, ru)}</option>)}
            </select>
            <div className="top-tools">
              <span className="top-mobile">{regionSeg}{langSeg}</span>
              <Theme />
              {r && <Agent key={rid + lang} region={r} />}
            </div>
          </header>
          <main id="main" className={`content view-${view}`}>
            {r ? <Page key={rid} r={r} view={view} /> : <p className="muted pad">{t('Loading the region', 'Загружаем регион')}</p>}
          </main>
        </div>
      </div>
    </LangCtx.Provider>
  )
}

// dark by default, as the design; one button switches to light, the head script applies the stored choice before paint
type Mode = 'light' | 'dark'
function Theme() {
  const t = useT()
  const [m, setM] = useState<Mode>(() => (stored('theme') === 'light' ? 'light' : 'dark'))
  useEffect(() => { document.documentElement.dataset.theme = m; store('theme', m) }, [m])
  const label = m === 'dark' ? t('Dark', 'Тёмная') : t('Light', 'Светлая')
  return (
    <button className="theme" onClick={() => setM(m === 'dark' ? 'light' : 'dark')}
      aria-label={`${t('Theme', 'Тема')}: ${label}`} title={`${t('Theme', 'Тема')}: ${label}`}>
      <span className={`theme-i theme-${m}`} aria-hidden /><span className="theme-t">{label}</span>
    </button>
  )
}

function Page({ r, view }: { r: Region; view: View }) {
  const [selected, setSelected] = useState(r.rep_cell)
  const [sid, setSid] = useState('current')
  const [metric, setMetric] = useState<MetricKey>('profit')
  const [layer, setLayer] = useState<NasaLayer>('none')
  const [price, setPrice] = useState(0)
  const [w, setW] = useState<Weights>({ profit: 2, water: 1, market: 1, n: 1 })
  const fit = useMemo(() => fitScores(r, price, w), [r, price, w])

  switch (view) {
    case 'map': return <Overview r={r} {...{ selected, setSelected, sid, setSid, metric, setMetric, layer, setLayer, fit }} />
    case 'strategies': return <Strategies r={r} {...{ price, setPrice, w, setW, fit }} />
    case 'time': return <TimeMachine r={r} />
    case 'climate': return <Twin r={r} />
    case 'tradeoffs': return <Tradeoffs r={r} />
    case 'carbon': return <CarbonWater r={r} />
    case 'ml': return <MlSection r={r} />
    case 'report': return <Report r={r} />
    case 'method': return <Method r={r} />
  }
}

// map view: toolbar on top, panel with tabs on the left, the map takes the rest
function Overview({ r, selected, setSelected, sid, setSid, metric, setMetric, layer, setLayer, fit }: {
  r: Region; selected: string; setSelected: (h: string) => void; sid: string; setSid: (s: string) => void
  metric: MetricKey; setMetric: (m: MetricKey) => void; layer: NasaLayer; setLayer: (l: NasaLayer) => void
  fit: ReturnType<typeof fitScores>
}) {
  const l = useLang(), t = useT()
  const ref = r.strategies
  const [tab, setTab] = useState<'summary' | 'cell'>('summary')
  const [panel, setPanel] = useState(true)
  const [detail, setDetail] = useState<string | null>(null) // ML detail cell (finer H3) inside `selected`
  const cell = r.cells.find((c) => c.h3 === selected)!
  const cellNo = r.cells.findIndex((c) => c.h3 === selected) + 1
  const metricKeys = (Object.keys(METRICS) as MetricKey[]).filter((k) => k !== 'irr' || r.irrigated)
  const cur = ref[0]
  const low = [...ref].sort((a, b) => a.metrics.erosion - b.metrics.erosion)[0]
  const lowCut = Math.round((1 - low.metrics.erosion / Math.max(cur.metrics.erosion, 0.01)) * 100)
  const top = [...ref].sort((a, b) => b.metrics.profit[1] - a.metrics.profit[1])[0]
  const n = r.years[1] - r.years[0] + 1
  const best = fit && ref.find((s) => s.id === fit.best)
  const tag = (s: Strategy) => (s.id === 'current' ? t('Now', 'Сейчас') : s.id)
  const pick = (h: string) => { setSelected(h); setTab('cell'); setPanel(true) }

  return (
    <div className="ov">
      <div className="toolbar">
        <label className="tool"><span>{t('Strategy', 'Стратегия')}</span>
          <select value={sid} onChange={(e) => setSid(e.target.value)}>
            {ref.map((s) => <option key={s.id} value={s.id}>{short(s, l)}</option>)}
          </select>
        </label>
        <div className="seg seg-sm" role="group" aria-label={t('Colour cells by', 'Цвет ячеек')} title={METRICS[metric][l === 'ru' ? 1 : 0]}>
          {metricKeys.map((k) => <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}>{METRIC_SHORT[k][l === 'ru' ? 1 : 0]}</button>)}
        </div>
        <label className="tool"><span>{t('NASA layer', 'Слой NASA')}</span>
          <select value={layer} onChange={(e) => setLayer(e.target.value as NasaLayer)}>
            {Object.entries(NASA_LAYERS).map(([k, v]) => <option key={k} value={k}>{l === 'ru' ? v.ru : v.label}</option>)}
          </select>
        </label>
        <span className="toolbar-end">
          <a className="btn btn-ghost btn-sm" href="#report">{t('Export', 'Выгрузка')}</a>
          <button className="btn btn-ghost btn-sm panel-toggle" onClick={() => setPanel((v) => !v)} aria-expanded={panel}>{panel ? t('Hide panel', 'Скрыть панель') : t('Show panel', 'Показать панель')}</button>
        </span>
      </div>
      <div className={`ov-body${panel ? '' : ' no-panel'}`}>
        {panel && (
          <aside className="ov-panel">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'summary'} onClick={() => setTab('summary')}>{t('Summary', 'Сводка')}</button>
              <button role="tab" aria-selected={tab === 'cell'} onClick={() => setTab('cell')}>
                {selected === r.rep_cell ? t('Reference field', 'Опорное поле') : t(`Cell ${cellNo}`, `Ячейка ${cellNo}`)}
              </button>
            </div>
            <div className="ov-scroll">
              {tab === 'summary' ? (
                <>
                  <div className="tiles">
                    <a className="tile tile-blue" href="#strategies"><strong>{usd(top.metrics.profit[1])}</strong><span>{t(`Most profit, ${tag(top)}`, `Больше всего прибыли: ${tag(top)}`)}</span></a>
                    <a className="tile tile-ink" href="#carbon"><strong>−{lowCut}%</strong><span>{t(`Soil loss, ${tag(low)} vs now`, `Эрозия: ${tag(low)} к текущей`)}</span></a>
                    {best && <a className="tile tile-grey" href="#strategies"><strong>{tag(best)}</strong><span>{t('Fits your priorities', 'Под ваши приоритеты')}</span></a>}
                    <a className="tile tile-white" href="#time"><strong>{n}</strong><span>{t(`Real seasons, ${r.years[0]}–${r.years[1]}`, `Реальных сезонов, ${r.years[0]}–${r.years[1]}`)}</span></a>
                  </div>
                  <section className="card-s">
                    <h2 className="h-sm">{t('Four rotations, one field', 'Четыре севооборота, одно поле')}</h2>
                    <table className="tbl">
                      <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Profit /ha', 'Прибыль /га')}</th><th>{t('Soil loss', 'Эрозия')}</th></tr></thead>
                      <tbody>
                        {ref.map((s) => (
                          <tr key={s.id} aria-selected={s.id === sid} onClick={() => setSid(s.id)}>
                            <td className="nw"><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                            <td className="mono">{usd(s.metrics.profit[1])}</td>
                            <td className="mono">{s.metrics.erosion} {t('t', 'т')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="small muted">{t('Median a year. Click a row to colour the map by that strategy; click a cell on the map for its soil.', 'Медиана за год. Нажмите на строку — карта окрасится по этой стратегии; на ячейку карты — её почва.')}</p>
                  </section>
                </>
              ) : (
                <section className="card-s">
                  <h2 className="h-sm">{selected === r.rep_cell ? t('Reference field', 'Опорное поле') : t(`Field cell ${cellNo} of ${r.cells.length}`, `Ячейка ${cellNo} из ${r.cells.length}`)}</h2>
                  <p className="small mono">
                    {t('clay', 'глина')} {cell.soil.clay.toFixed(0)}% · {t('sand', 'песок')} {cell.soil.sand.toFixed(0)}% · SOC {cell.soil.soc.toFixed(1)} {t('g/kg', 'г/кг')}
                  </p>
                  <table className="tbl">
                    <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Profit P10–P90', 'Прибыль P10–P90')}</th><th>{t('Soil loss', 'Эрозия')}</th></tr></thead>
                    <tbody>
                      {ref.map((s) => {
                        const m = cell.s[s.id]
                        return (
                          <tr key={s.id} aria-selected={s.id === sid} onClick={() => setSid(s.id)}>
                            <td className="nw"><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                            <td className="mono">{usd(m.profit[0])}…{usd(m.profit[2])}</td>
                            <td className="mono">{m.erosion}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <MlCellBox r={r} h3={selected} detail={detail} onWholeCell={() => setDetail(null)} />
                  {selected !== r.rep_cell && <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(r.rep_cell); setDetail(null) }}>{t('Back to the reference field', 'Вернуться к опорному полю')}</button>}
                </section>
              )}
            </div>
          </aside>
        )}
        <MapView region={r} strategy={sid} metric={metric} layer={layer} selected={selected} onSelect={pick} detail={detail} onSelectDetail={setDetail} />
      </div>
    </div>
  )
}

function Strategies({ r, price, setPrice, w, setW, fit }: {
  r: Region; price: number; setPrice: (v: number) => void; w: Weights; setW: (v: Weights) => void; fit: ReturnType<typeof fitScores>
}) {
  const t = useT()
  return (
    <section className="sec" id="strategies">
      <div className="wrap">
        <SecHead title={t('Four rotations to test with your agronomist', 'Четыре севооборота для проверки с агрономом')} sub={t('Current practice against three alternatives. Set what matters on your farm.', 'Текущая практика против трёх альтернатив. Задайте, что важно в вашем хозяйстве.')} />
        <Priorities r={r} price={price} setPrice={setPrice} w={w} setW={setW} fit={fit} />
        <div className="cards">
          {r.strategies.map((s) => <StrategyCard key={s.id} r={r} s={s} price={price} best={fit?.best === s.id} />)}
        </div>
      </div>
    </section>
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

const irrName = (i: string | undefined, t: (a: string, b: string) => string) => (i ? `, ${i === 'drip' ? t('drip', 'капельный') : t('flood', 'напуск')}` : '')

// ---------- farmer priorities: weights over four numbers the pipeline already computed ----------
type Weights = { profit: number; water: number; market: number; n: number }
type Dim = keyof Weights
const DIMS: Dim[] = ['profit', 'water', 'market', 'n']
const LEVEL: [string, string][] = [['ignore', 'не важно'], ['some', 'немного'], ['important', 'важно'], ['top', 'главное']]

// price slider: crop prices change revenue only, costs stay (pct = -0.3..0.3)
const atPrice = (s: Strategy, pct: number, v: number) => v + pct * (s.farm?.revenue ?? 0)

// score 0-1 relative to these four strategies, on a ratio scale so a 15% gap stays a 15% gap
// (min-max would turn 210 vs 241 kg N into 1 vs 0). Best per dimension = 1.
function fitScores(r: Region, pct: number, w: Weights) {
  const S = r.strategies
  if (!S.every((s) => s.farm)) return null // data built before the priorities existed
  const raw: Record<Dim, number[]> = {
    profit: S.map((s) => atPrice(s, pct, s.metrics.profit[1])),
    water: S.map((s) => (r.irrigated ? s.metrics.irr[1] : s.farm!.water_stress ?? 0)),
    market: S.map((s) => s.farm!.deep_market ?? 0),
    n: S.map((s) => s.farm!.n_kg),
  }
  const up: Record<Dim, boolean> = { profit: true, water: false, market: true, n: false }
  const part = Object.fromEntries(DIMS.map((d) => {
    const v = raw[d], lo = Math.min(...v), hi = Math.max(...v)
    const f = (x: number) => (hi <= 0 ? (x === hi ? 1 : 0) : up[d] ? x / hi : 1 - (x - lo) / hi)
    return [d, v.map((x) => Math.max(0, Math.min(1, f(x))))]
  })) as Record<Dim, number[]>
  const tot = DIMS.reduce((a, d) => a + w[d], 0)
  const score = S.map((_, i) => (tot ? DIMS.reduce((a, d) => a + w[d] * part[d][i], 0) / tot : 0))
  const bi = score.indexOf(Math.max(...score))
  return { raw, part, score, best: S[bi].id, bi }
}

function Priorities({ r, price, setPrice, w, setW, fit }: {
  r: Region; price: number; setPrice: (v: number) => void; w: Weights; setW: (v: Weights) => void; fit: ReturnType<typeof fitScores>
}) {
  const l = useLang(), t = useT()
  if (!fit) return null
  const name: Record<Dim, string> = {
    profit: t('Profit', 'Прибыль'), water: t('Water', 'Вода'), market: t('Market', 'Рынок'), n: t('Nitrogen', 'Азот'),
  }
  const hint: Record<Dim, string> = {
    profit: t('median $/ha a year at these prices', 'медиана $/га в год при этих ценах'),
    water: r.irrigated ? t('pumped water, mm a year', 'откачка, мм в год') : t('crop water demand not met', 'недобор воды культурой'),
    market: t('revenue from crops with several buyers', 'выручка с культур, у которых много покупателей'),
    n: t('mineral N bought, kg/ha a year', 'покупной азот, кг/га в год'),
  }
  const val = (d: Dim, i: number) => {
    const v = fit.raw[d][i]
    if (d === 'profit') return usd(v)
    if (d === 'water') return r.irrigated ? `${Math.round(v)} ${t('mm', 'мм')}` : `${Math.round(v * 100)}%`
    if (d === 'market') return `${Math.round(v * 100)}%`
    return `${Math.round(v)} ${t('kg', 'кг')}`
  }
  const on = DIMS.filter((d) => w[d] > 0)
  const strong = on.filter((d) => fit.part[d][fit.bi] > 0.99).map((d) => name[d].toLowerCase())
  const weak = on.filter((d) => fit.part[d][fit.bi] < 0.75).map((d) => name[d].toLowerCase())
  const col: Record<Dim, string> = {
    profit: t('Profit', 'Прибыль'), water: r.irrigated ? t('Pumped', 'Откачка') : t('Water shortfall', 'Недобор воды'),
    market: t('Deep market', 'Ходовой рынок'), n: t('N bought', 'Покупной азот'),
  }
  const best = r.strategies[fit.bi]
  return (
    <div className="panel prio">
      <div className="prio-in">
        {DIMS.map((d) => (
          <label className="field" key={d}>
            <span className="label">{name[d]}: {LEVEL[w[d]][l === 'ru' ? 1 : 0]}</span>
            <input type="range" min={0} max={3} value={w[d]} onChange={(e) => setW({ ...w, [d]: +e.target.value })} />
          </label>
        ))}
        <label className="field">
          <span className="label">{t('Crop prices', 'Цены на урожай')}: {price > 0 ? '+' : ''}{Math.round(price * 100)}%</span>
          <input type="range" min={-0.3} max={0.3} step={0.05} value={price} onChange={(e) => setPrice(+e.target.value)} />
        </label>
      </div>
      <table className="tbl">
        <thead><tr><th>{t('Strategy', 'Стратегия')}</th>{DIMS.map((d) => <th key={d} title={hint[d]}>{col[d]}</th>)}<th>{t('Fit', 'Подходит')}</th></tr></thead>
        <tbody>
          {r.strategies.map((s, i) => (
            <tr key={s.id}>
              <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
              {DIMS.map((d) => <td key={d} className={`mono${w[d] && fit.part[d][i] > 0.99 ? ' lead-cell' : ''}`}>{val(d, i)}</td>)}
              <td><span className="fit"><i style={{ width: `${Math.round(fit.score[i] * 100)}%`, background: SC[s.id] }} /></span><span className="mono small">{Math.round(fit.score[i] * 100)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        {on.length ? <>
          <strong>{t('Best fit', 'Лучше всего подходит')}: {short(best, l)}.</strong>{' '}
          {strong.length > 0 && t(`Leads on: ${strong.join(', ')}.`, `Лидирует: ${strong.join(', ')}.`)}{' '}
          {weak.length > 0 && t(`Falls behind on: ${weak.join(', ')}.`, `Отстаёт: ${weak.join(', ')}.`)}
        </> : t('Turn on at least one priority.', 'Включите хотя бы один приоритет.')}
      </p>
      <p className="small muted">
        {t(`${DIMS.map((d) => `${col[d]}: ${hint[d]}`).join('. ')}. Fit is relative to these four. Nitrogen rates and market depth are assumptions to check with an agronomist.`,
          `${DIMS.map((d) => `${col[d]}: ${hint[d]}`).join('. ')}. «Подходит» — относительно этих четырёх. Нормы азота и глубина рынка — допущения, проверьте с агрономом.`)}
      </p>
    </div>
  )
}

// card: name, rotation, why and benefit, the median profit large, three numbers, the risk in one line
function StrategyCard({ r, s, price, best }: { r: Region; s: Strategy; price: number; best: boolean }) {
  const l = useLang(), t = useT()
  const m = s.metrics
  const name = sname(s, l).split(':')[0]
  const why = (l === 'ru' && s.why_ru) || s.why
  return (
    <article className="panel card" style={{ borderTopColor: SC[s.id] }}>
      <div>
        <h3 className="h-sm">{name}{best && <span className="badge best">{t('best fit', 'лучше всего')}</span>}</h3>
        <p className="small muted">{s.notill ? 'No-till' : t('Tilled', 'Вспашка')}{irrName(s.irrigation, t)}</p>
      </div>
      <Rotation r={r} s={s} />
      <div className="small why">
        {why && <p><strong>{t('Why', 'Почему')}.</strong> {why}</p>}
        <p><strong>{t('Benefit', 'Польза')}.</strong> {(l === 'ru' && s.idea_ru) || s.idea}</p>
      </div>
      <div className="profit">
        <strong>{usd(atPrice(s, price, m.profit[1]))}</strong><span className="muted">{t(' /ha a year', ' /га в год')}</span>
        <p className="small muted"><span className="nw">{t('bad year', 'плохой год')} {usd(atPrice(s, price, m.profit[0]))}</span> · <span className="nw">{t('good year', 'хороший')} {usd(atPrice(s, price, m.profit[2]))}</span></p>
      </div>
      <dl className="stats">
        <div><dt>{t('Soil loss', 'Эрозия')}</dt><dd className="mono">{m.erosion}<small> {t('t/ha', 'т/га')}</small></dd></div>
        <div><dt>{t('Carbon', 'Углерод')}</dt><dd className="mono">{m.dsoc > 0 ? '+' : ''}{m.dsoc}<small> {t('t/ha', 'т/га')}</small></dd></div>
        {r.irrigated
          ? <div><dt>{t('Pumped', 'Откачка')}</dt><dd className="mono">{Math.round(m.irr[1])}<small> {t('mm', 'мм')}</small></dd></div>
          : <div><dt>{t('Loss years', 'Убыточных лет')}</dt><dd className="mono">{Math.round(m.loss_years * 100)}%</dd></div>}
      </dl>
      <p className="small risk">{t('Risk', 'Риск')}: {(l === 'ru' && s.risk_ru) || s.risk}</p>
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
        <SecHead n="4" title={t('Climate twin: the same field, warmer and drier', 'Климатический двойник: то же поле, теплее и суше')} sub={t('Historical weather shifted by a temperature and rainfall change.', 'Историческая погода, сдвинутая по температуре и осадкам.')} />
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
        <ImergPanel r={r} />
      </div>
    </section>
  )
}

// headline numbers run on NASA POWER rain; this reruns the reference field with GPM IMERG monthly totals
function ImergPanel({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const im = r.imerg
  if (!im) return null
  const pct = Math.round((im.ratio - 1) * 100)
  const rows = im.years.map(([year, power, imerg]) => ({ year, power: Math.round(power), imerg: Math.round(imerg) }))
  return (
    <div className="two" style={{ marginTop: 16 }}>
      <div className="panel chart">
        <h3 className="h-sm">{t('Rain a year: NASA POWER against GPM IMERG', 'Осадки за год: NASA POWER против GPM IMERG')}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="var(--muted)" interval={3} />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" unit={t(' mm', ' мм')} width={60} />
            <Tooltip />
            <Bar dataKey="power" name="NASA POWER" fill={SC.current} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="imerg" name="GPM IMERG" fill={SC.B} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <div className="legend"><span><i style={{ background: SC.current }} />NASA POWER</span><span><i style={{ background: SC.B }} />GPM IMERG Final</span></div>
      </div>
      <div className="panel">
        <h3 className="h-sm">{t('The same strategies with IMERG rain', 'Те же стратегии с осадками IMERG')}</h3>
        <table className="tbl">
          <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Median, POWER', 'Медиана, POWER')}</th><th>{t('Median, IMERG', 'Медиана, IMERG')}</th><th>{t('Loss years', 'Убыточных лет')}</th>{r.irrigated && <th>{t('Pumped', 'Откачка')}</th>}</tr></thead>
          <tbody>
            {r.strategies.map((s) => {
              const x = im.strategies[s.id]
              if (!x) return null
              return (
                <tr key={s.id}>
                  <td className="nw"><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                  <td className="mono">{usd(s.metrics.profit[1])}</td>
                  <td className="mono">{usd(x.profit[1])}</td>
                  <td className="mono">{Math.round(s.metrics.loss_years * 100)}% → {Math.round(x.loss_years * 100)}%</td>
                  {r.irrigated && <td className="mono">{Math.round(s.metrics.irr[1])} → {Math.round(x.irr)} {t('mm', 'мм')}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="small muted">
          {t(`Over ${im.years[0][0]}–${im.years[im.years.length - 1][0]} IMERG sees ${Math.abs(pct)}% ${pct >= 0 ? 'more' : 'less'} rain on this field than POWER. POWER's daily rain is scaled to IMERG's monthly totals and the model rerun. The rest of the page stays on POWER; the gap shows how much the answer depends on the rain source.`,
            `За ${im.years[0][0]}–${im.years[im.years.length - 1][0]} IMERG видит на этом поле на ${Math.abs(pct)}% ${pct >= 0 ? 'больше' : 'меньше'} осадков, чем POWER. Суточный дождь POWER масштабирован до месячных сумм IMERG, модель пересчитана. Остальная страница считает по POWER; разница показывает, насколько ответ зависит от источника осадков.`)}
        </p>
      </div>
    </div>
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
              {t(`RothC-26.3, ${Math.round(r.assumptions.buffer * 100)}% buffer, $${r.assumptions.co2_price[0]}–${r.assumptions.co2_price[1]}/t.`,
                `RothC-26.3, буфер ${Math.round(r.assumptions.buffer * 100)}%, $${r.assumptions.co2_price[0]}–${r.assumptions.co2_price[1]}/т.`)}
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
                <p className="small muted">{t('GRACE-FO on the map shows the basin losing stored water.', 'GRACE-FO на карте показывает потерю запасов воды бассейном.')}</p>
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
        <SecHead n="9" title={t('Method', 'Метод')} />
        <div className="two" style={{ marginBottom: 16 }}>
          <div className="panel">
            <h3 className="h-sm">{t('Data', 'Данные')}</h3>
            <ul className="list-plain small">
              <li><strong>NASA POWER</strong> {t('daily weather', 'суточная погода')}, {r.years[0] - 1}–{r.years[1] + 1}</li>
              <li><strong>SoilGrids 2.0</strong> {t('soil, 0–30 cm', 'почва, 0–30 см')}</li>
              {r.imerg && <li><strong>GPM IMERG Final</strong> {t('monthly rain, second rain source', 'месячные осадки, второй источник дождя')}</li>}
              {r.smap && <li><strong>SMAP L4</strong> {t('root-zone moisture, check of the water balance', 'влага корневой зоны, проверка водного баланса')}</li>}
              <li><strong>NASA GIBS</strong> {t('map layers', 'слои карты')}: MODIS, SMAP, IMERG, GRACE-FO</li>
              {mlCells(r).length > 0 && <li><strong>ML</strong> {mlTitle(r) || t('crop map', 'карта культур')}</li>}
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
        </div>
        <SmapPanel r={r} />
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

// model root-zone water (mm) and SMAP (m3/m3) have different units: both as z-scores on one axis
function SmapPanel({ r }: { r: Region }) {
  const t = useT()
  const sm = r.smap
  if (!sm) return null
  const z = (k: 1 | 2) => {
    const v = sm.series.map((x) => x[k]), m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
    return v.map((x) => +((x - m) / sd).toFixed(2))
  }
  const zs = z(1), zm = z(2)
  const rows = sm.series.map((x, i) => ({ date: x[0], smap: zs[i], model: zm[i], sm: x[1], mm: x[2] }))
  const f = (v: number) => v.toFixed(2).replace('.', t('.', ','))
  return (
    <div className="panel chart" style={{ marginBottom: 16 }}>
      <h3 className="h-sm">{t('Check: model soil water against SMAP at the reference field', 'Проверка: влага почвы в модели против SMAP на опорном поле')}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => String(d).slice(0, 4)} interval={35} tick={{ fontSize: 12 }} stroke="var(--muted)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" width={32} />
          <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.3} />
          <Tooltip content={({ payload }) => {
            const d = payload?.[0]?.payload
            return d ? <div className="tip"><strong>{d.date}</strong><br />SMAP {f(d.sm)} {t('m³/m³', 'м³/м³')}<br />{t('model', 'модель')} {Math.round(d.mm)} {t('mm', 'мм')}</div> : null
          }} />
          <Line dataKey="smap" stroke={SC.current} strokeWidth={2} dot={false} isAnimationActive={false} name="SMAP" />
          <Line dataKey="model" stroke={SC.A} strokeWidth={2} dot={false} isAnimationActive={false} name={t('Model', 'Модель')} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend"><span><i style={{ background: SC.current }} />SMAP L4, {t('root zone', 'корневая зона')}</span><span><i style={{ background: SC.A }} />{t('Model, current practice', 'Модель, текущая практика')}</span></div>
      <p className="small muted">
        {t(`r = ${f(sm.r)} on ${sm.n} dates, ${f(sm.r_anom)} with the seasonal cycle removed. Both lines in standard units. SMAP is a 9 km grid read from NASA GIBS colour tables, so a cell is a district average, not one field.`,
          `r = ${f(sm.r)} на ${sm.n} датах, ${f(sm.r_anom)} без сезонного хода. Обе линии в стандартных единицах. SMAP — сетка 9 км, прочитанная по цветовым таблицам NASA GIBS: это среднее по округе, а не одно поле.`)}
      </p>
    </div>
  )
}

function MlSection({ r }: { r: Region }) {
  const t = useT(), l = useLang()
  const n = mlCells(r).length, nd = mlDetail(r).length
  return (
    <section className="sec" id="ml">
      <div className="wrap">
        <SecHead n="7" title={t('ML layers: what grows now and field-scale moisture', 'ML-слои: что растёт сейчас и влага в масштабе поля')}
          sub={t('Satellites see the district; ML brings it down to the field. Results appear in the map panel when you click a cell.', 'Спутник видит район, ML доводит до поля. Результат виден в панели карты при клике на ячейку.')} />
        <div className="two ml-grid">
          <div className="panel">
            <div className="row-between"><h3 className="h-sm">{t('Crop map', 'Карта культур')}</h3><span className={`status ${n ? 'on' : ''}`}>{n ? t('Connected', 'Подключено') : t('Not connected', 'Не подключено')}</span></div>
            <p className="small muted">{t('Classifies the current crop of each cell from HLS / MODIS time series, so "current practice" comes from the field, not a guess.', 'Определяет текущую культуру ячейки по рядам HLS / MODIS, чтобы «текущая практика» бралась с поля, а не из догадки.')}</p>
          </div>
          <div className="panel">
            <div className="row-between"><h3 className="h-sm">{t('Soil moisture downscaling', 'Детализация влаги почвы')}</h3><span className="status">{t('Awaiting model', 'Ждёт модель')}</span></div>
            <p className="small muted">{t('SMAP itself is connected (9 km, see Method). This model, from the ML repo, sharpens root-zone moisture to the cell, with a prediction interval.', 'Сам SMAP подключён (9 км, см. «Метод»). Эта модель из ML-репозитория уточняет влагу корневой зоны до ячейки, с интервалом предсказания.')}</p>
          </div>
        </div>
        <p className="small muted note">
          {n
            ? [mlTitle(r), t(`${n} cells`, `ячеек: ${n}`), nd ? t(`${nd} field-scale cells on the map`, `мелких ячеек на карте: ${nd}`) : '', mlValidation(r, l)].filter(Boolean).join(' · ')
            : t(`The models live in a separate repository. Put its output in data/ml/${r.id}.json and rebuild: the cell panel picks it up.`, `Модели живут в отдельном репозитории. Положите их вывод в data/ml/${r.id}.json и пересоберите: его покажет панель ячейки.`)}
        </p>
      </div>
    </section>
  )
}

const mlTitle = (r: Region) => [r.ml?.model, r.ml?.version].filter(Boolean).join(' ')

// ML block in the cell panel. Every field of the ML file is optional, so each line shows only when its field is there.
// With `detail` set (a finer H3 cell clicked on the map), that cell is shown instead of the whole grid cell.
function MlCellBox({ r, h3, detail, onWholeCell }: { r: Region; h3: string; detail?: string | null; onWholeCell?: () => void }) {
  const l = useLang(), t = useT()
  const fine = detail ? r.ml?.detail?.cells?.[detail] : undefined
  const c = fine && fine.p === h3 ? fine : r.ml?.cells?.[h3]
  const isFine = !!fine && c === fine
  const top = c?.crop_top
  const share = top ? c?.crop_top_share : c?.crop_pixel_share ?? c?.crop_p
  const years = Object.entries(c?.years ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (!c || !mlHas(c)) {
    return <div className="ml-box"><span className="badge">ML</span><span className="muted">{t('No ML data for this cell', 'ML-данных для ячейки нет')}</span></div>
  }
  const src = (s?: string) => (s === 'model' ? t('model', 'модель') : s)
  return (
    <div className="ml-box ml-cell">
      <span className="badge">ML</span>
      <div className="ml-body">
        {isFine && <span className="ml-scale">{t('Field-scale cell (~0.7 km²)', 'Участок ~0,7 км²')}</span>}
        {(top || c.crop) && (
          <p>
            <strong>{top ? mlCrop(top, l) : mlText(c.crop!, l)}</strong>
            {share != null && <span className="muted"> · {t('pixel share', 'доля пикселей')} {Math.round(share * 100)}%</span>}
          </p>
        )}
        {top && c.crop && <p className="small muted">{mlText(c.crop, l)}</p>}
        {c.low_confidence && <span className="ml-flag">{t('low confidence', 'низкая достоверность')}</span>}
        {years.length > 0 && (
          <ul className="ml-years">
            {years.map(([y, v]) => (
              <li key={y}>
                <span><span className="mono">{y}</span> {v.crop ? mlText(v.crop, l) : '–'}{v.source && <span className="ml-src">{src(v.source)}</span>}</span>
                {v.bare_months && (
                  <span className="small muted">
                    {v.bare_months.length ? t(`bare: ${months(v.bare_months, l)}`, `голая почва: ${months(v.bare_months, l)}`) : t('green all season', 'зелёная весь сезон')}
                    {v.low_obs_months?.length ? t(` · too few images: ${months(v.low_obs_months, l)}`, ` · мало снимков: ${months(v.low_obs_months, l)}`) : ''}
                  </span>
                )}
                {!v.bare_months && v.bare_obs_dates != null && <span className="muted"> · {t(`bare on ${v.bare_obs_dates} dates`, `дат с голой почвой: ${v.bare_obs_dates}`)}</span>}
              </li>
            ))}
          </ul>
        )}
        {isFine && onWholeCell && <button className="btn btn-ghost btn-sm" onClick={onWholeCell}>{t('Show the whole cell', 'Показать всю ячейку')}</button>}
        {mlValidation(r, l) && (
          <details className="ml-validation small muted">
            <summary>{t('How the model was checked', 'Как проверяли модель')}</summary>
            <p>{mlValidation(r, l)}</p>
          </details>
        )}
      </div>
    </div>
  )
}
