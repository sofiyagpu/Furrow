import { useEffect, useMemo, useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis, ReferenceLine, Cell as RCell,
} from 'recharts'
import MapView, { NASA_LAYERS, type MetricKey, type NasaLayer } from './MapView'
import Agent from './Agent'
import type { Region, Strategy } from './types'

// categorical slots, fixed order (validated: dataviz palette check, contrast WARN -> direct labels + tables)
const SC: Record<string, string> = { current: '#2a78d6', A: '#eb6834', B: '#1baf7a', C: '#eda100' }
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
const short = (s: Strategy) => (s.id === 'current' ? 'Current' : `Strategy ${s.id}`)

const METRICS: Record<MetricKey, string> = {
  profit: 'Median profit, $/ha',
  erosion: 'Soil loss, t/ha a year',
  dsoc: 'Soil carbon change, t C/ha a year',
  irr: 'Pumped water, mm a year',
}

export default function App() {
  const [rid, setRid] = useState<'vko' | 'az'>(() => (new URLSearchParams(location.search).get('r') === 'az' ? 'az' : 'vko'))
  const [data, setData] = useState<Record<string, Region>>({})
  const r = data[rid]

  useEffect(() => {
    if (data[rid]) return
    fetch(`${import.meta.env.BASE_URL}data/${rid}.json`).then((x) => x.json()).then((d) => setData((o) => ({ ...o, [rid]: d })))
  }, [rid, data])

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <div className="wrap nav-in">
          <a href="#top" className="mark" aria-label="Furrow home">furrow<span>.</span></a>
          <nav aria-label="Sections" className="nav-links">
            <a href="#map">Map</a><a href="#strategies">Strategies</a><a href="#time">Time machine</a>
            <a href="#twin">Climate</a><a href="#tradeoffs">Trade-offs</a><a href="#carbon">Carbon and water</a><a href="#method">Method</a>
          </nav>
          <div className="seg" role="group" aria-label="Region">
            <button aria-pressed={rid === 'vko'} onClick={() => setRid('vko')}>East Kazakhstan</button>
            <button aria-pressed={rid === 'az'} onClick={() => setRid('az')}>Arizona</button>
          </div>
        </div>
      </header>
      <main id="main">
        {r ? <Page key={rid} r={r} /> : <section className="sec hero"><div className="wrap"><p className="muted">Loading the region</p></div></section>}
      </main>
      <footer className="foot">
        <div className="wrap foot-in">
          <span>Weather: NASA POWER. Soil: ISRIC SoilGrids 2.0. Layers: NASA GIBS (MODIS, SMAP, GPM IMERG, GRACE-FO). Imagery: Esri, Maxar.</span>
          <span>NASA Space Apps 2026 · Adapting farms with NASA data</span>
        </div>
      </footer>
    </>
  )
}

function Page({ r }: { r: Region }) {
  const ref = r.strategies
  const cur = ref[0]
  const [selected, setSelected] = useState(r.rep_cell)
  const [sid, setSid] = useState('current')
  const [metric, setMetric] = useState<MetricKey>('profit')
  const [layer, setLayer] = useState<NasaLayer>('ndvi')
  const cell = r.cells.find((c) => c.h3 === selected)!
  const bestErosion = [...ref].sort((a, b) => a.metrics.erosion - b.metrics.erosion)[0]
  const metricKeys = (Object.keys(METRICS) as MetricKey[]).filter((k) => k !== 'irr' || r.irrigated)

  return (
    <>
      {/* hero: the product itself — current rotation against the alternatives on the reference field */}
      <section className="sec hero" id="top" data-enter>
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">{r.name}</p>
            <h1 className="h-xl">Crop rotation planner for dry farms, built on NASA data</h1>
            <p className="lead">
              Compare rotations on your field before you sow them: profit, soil loss, soil carbon{r.irrigated ? ' and pumped water' : ''}, replayed
              over {r.years[1] - r.years[0] + 1} real seasons of NASA POWER weather ({r.years[0]}–{r.years[1]}).
            </p>
            <div className="actions">
              <a className="btn btn-solid" href="#map">Open the field map</a>
              <a className="btn btn-ghost" href="#tradeoffs">See the trade-offs</a>
            </div>
          </div>
          <div className="panel hero-card" aria-label="Reference field summary">
            <div className="row-between"><span className="label">Reference field</span><span className="mono small">{r.cells.length} soil cells</span></div>
            {ref.map((s) => (
              <div className="hero-row" key={s.id}>
                <span className="dot" style={{ background: SC[s.id] }} />
                <span className="hero-name">{short(s)}</span>
                <Rotation r={r} s={s} />
                <span className="mono">{usd(s.metrics.profit[1])}</span>
                <span className="mono muted">{s.metrics.erosion} t</span>
              </div>
            ))}
            <p className="small muted">
              Median profit per hectare a year and soil loss. Lowest soil loss: {short(bestErosion)}, {Math.round((1 - bestErosion.metrics.erosion / Math.max(cur.metrics.erosion, 0.01)) * 100)}% below current practice.
            </p>
          </div>
        </div>
      </section>

      <section className="sec" id="map" style={{ ['--h' as string]: 1 }}>
        <div className="wrap">
          <h2 className="h-lg">Field map with NASA layers</h2>
          <div className="map-grid">
            <MapView region={r} strategy={sid} metric={metric} layer={layer} selected={selected} onSelect={setSelected} />
            <div className="panel side">
              <Field label="Strategy on the map">
                <select value={sid} onChange={(e) => setSid(e.target.value)}>
                  {ref.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Colour cells by">
                <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
                  {metricKeys.map((k) => <option key={k} value={k}>{METRICS[k]}</option>)}
                </select>
              </Field>
              <Field label="NASA layer">
                <select value={layer} onChange={(e) => setLayer(e.target.value as NasaLayer)}>
                  {Object.entries(NASA_LAYERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <div className="legend-ramp"><span>worse</span><i /><span>better, within this region</span></div>
              <h3 className="h-sm">Cell {selected.slice(0, 7)}{selected === r.rep_cell ? ', the reference field' : ''}</h3>
              <p className="small muted mono">
                clay {cell.soil.clay.toFixed(0)}% · sand {cell.soil.sand.toFixed(0)}% · SOC {cell.soil.soc.toFixed(1)} g/kg · {cell.soc0} t C/ha in 0–30 cm
              </p>
              {r.ml?.cells[selected] && (
                <p className="small">ML layer: {r.ml.cells[selected].crop} ({Math.round((r.ml.cells[selected].crop_p ?? 0) * 100)}%). {r.ml.validation}</p>
              )}
              <table className="tbl">
                <thead><tr><th>Strategy</th><th>Profit P10–P90</th><th>Soil loss</th><th>ΔC</th></tr></thead>
                <tbody>
                  {ref.map((s) => {
                    const m = cell.s[s.id]
                    return (
                      <tr key={s.id} aria-selected={s.id === sid} onClick={() => setSid(s.id)}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s)}</td>
                        <td className="mono">{usd(m.profit[0])} to {usd(m.profit[2])}</td>
                        <td className="mono">{m.erosion}</td>
                        <td className="mono">{m.dsoc > 0 ? '+' : ''}{m.dsoc}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="small muted">
                SMAP and IMERG are 9–11 km pixels: they show the district, not your field. Cells are H3, about 250 km².
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="strategies">
        <div className="wrap">
          <h2 className="h-lg">Four rotations to test with your agronomist</h2>
          <p className="lead narrow">These are hypotheses, not advice. Each card shows the range across {r.years[1] - r.years[0] + 1} weather years on the reference field.</p>
          <div className="cards">
            {ref.map((s) => <StrategyCard key={s.id} r={r} s={s} />)}
          </div>
        </div>
      </section>

      <TimeMachine r={r} />
      <Twin r={r} />
      <Tradeoffs r={r} />
      <CarbonWater r={r} />
      <Method r={r} />
      <Agent region={r} />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span className="label">{label}</span>{children}</label>
}

function Rotation({ r, s }: { r: Region; s: { rotation: string[] } }) {
  return (
    <span className="rot">
      {s.rotation.map((c, i) => <span key={i} className={`crop crop-${r.crops[c].family}`}>{r.crops[c].label.split(' (')[0]}</span>)}
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

function StrategyCard({ r, s }: { r: Region; s: Strategy }) {
  const all = r.strategies.flatMap((x) => x.metrics.profit)
  const lo = Math.min(0, ...all), hi = Math.max(...all)
  const m = s.metrics
  return (
    <article className="panel card" style={{ borderTopColor: SC[s.id] }}>
      <h3 className="h-sm">{s.name}</h3>
      <Rotation r={r} s={s} />
      <p className="small">{s.idea}</p>
      <p className="small risk">{s.risk}</p>
      <div className="kv">
        <span className="label">Profit per ha, 1-in-10 bad year to 1-in-10 good</span>
        <BandBar band={m.profit} lo={lo} hi={hi} />
        <span className="mono">{usd(m.profit[0])} · <strong>{usd(m.profit[1])}</strong> · {usd(m.profit[2])}</span>
      </div>
      <dl className="stats">
        <div><dt>Loss years</dt><dd className="mono">{Math.round(m.loss_years * 100)}%</dd></div>
        <div><dt>Soil loss</dt><dd className="mono">{m.erosion} t/ha</dd></div>
        <div><dt>Bare days</dt><dd className="mono">{m.bare_days}</dd></div>
        <div><dt>Soil C</dt><dd className="mono">{m.dsoc > 0 ? '+' : ''}{m.dsoc} t/ha</dd></div>
        {r.irrigated && <div><dt>Pumped</dt><dd className="mono">{Math.round(m.irr[1])} mm</dd></div>}
        <div><dt>Tillage</dt><dd>{s.notill ? 'No-till' : 'Tilled'}{s.irrigation ? `, ${s.irrigation}` : ''}</dd></div>
      </dl>
    </article>
  )
}

function TimeMachine({ r }: { r: Region }) {
  const years = r.strategies[0].timeline.map((t) => t.year)
  const [year, setYear] = useState(() => {
    const t = r.strategies[0].timeline
    return [...t].sort((a, b) => a.profit[1] - b.profit[1])[0].year // open on the worst year for current practice
  })
  const [show, setShow] = useState<string[]>(r.strategies.map((s) => s.id))
  const rows = years.map((y) => {
    const o: Record<string, number | [number, number]> = { year: y }
    for (const s of r.strategies) {
      const t = s.timeline.find((x) => x.year === y)
      if (!t) continue
      o[s.id] = t.profit[1]
      o[s.id + '_band'] = [t.profit[0], t.profit[2]]
    }
    return o
  })
  const dek = r.strategies.map((s) => s.dekads.filter((d) => d[0].startsWith(String(year))))
  const dekRows = dek[0].map((d, i) => {
    const o: Record<string, number | string> = { date: d[0].slice(5) }
    r.strategies.forEach((s, j) => (o[s.id] = dek[j][i]?.[1] ?? 0))
    return o
  })

  return (
    <section className="sec" id="time">
      <div className="wrap">
        <h2 className="h-lg">Time machine: replay every season since {years[0]}</h2>
        <div className="row-between filters">
          <div className="chips" role="group" aria-label="Strategies shown">
            {r.strategies.map((s) => (
              <button key={s.id} className="chip" aria-pressed={show.includes(s.id)}
                onClick={() => setShow((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>
                <span className="dot" style={{ background: SC[s.id] }} />{short(s)}
              </button>
            ))}
          </div>
          <label className="field inline">
            <span className="label">Year {year}</span>
            <input type="range" min={years[0]} max={years[years.length - 1]} value={year} onChange={(e) => setYear(+e.target.value)} />
          </label>
        </div>
        <div className="two">
          <div className="panel chart">
            <h3 className="h-sm">Profit per hectare by harvest year</h3>
            <p className="small muted">Line: median over every year the rotation could have started. Shade: the spread between them.</p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={rows} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.4} />
                <ReferenceLine x={year} stroke="var(--ink)" strokeDasharray="3 3" />
                <Tooltip formatter={(v) => (Array.isArray(v) ? `${usd(+v[0])} to ${usd(+v[1])}` : usd(Number(v)))} />
                {r.strategies.filter((s) => show.includes(s.id)).map((s) => (
                  <Area key={s.id + 'b'} dataKey={s.id + '_band'} stroke="none" fill={SC[s.id]} fillOpacity={0.1} isAnimationActive={false} legendType="none" name={`${short(s)} range`} />
                ))}
                {r.strategies.filter((s) => show.includes(s.id)).map((s) => (
                  <Line key={s.id} dataKey={s.id} stroke={SC[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} name={short(s)}
                    label={(p: { index?: number; x?: number | string; y?: number | string }) => p.index === rows.length - 1 ? <text x={Number(p.x ?? 0) + 6} y={Number(p.y ?? 0) + 4} fontSize={11} fill="var(--ink)">{s.id === 'current' ? 'Now' : s.id}</text> : <g />} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="panel chart">
            <h3 className="h-sm">Soil water in {year}, mm in the root zone</h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dekRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted)" interval={5} />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" width={40} />
                <Tooltip />
                {r.strategies.filter((s) => show.includes(s.id)).map((s) => (
                  <Line key={s.id} dataKey={s.id} stroke={SC[s.id]} strokeWidth={2} dot={false} isAnimationActive={false} name={short(s)} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <table className="tbl">
              <thead><tr><th>Strategy</th><th>Harvested in {year}</th><th>Profit</th>{r.irrigated && <th>Pumped</th>}</tr></thead>
              <tbody>
                {r.strategies.filter((s) => show.includes(s.id)).map((s) => {
                  const t = s.timeline.find((x) => x.year === year)
                  return (
                    <tr key={s.id}>
                      <td><span className="dot" style={{ background: SC[s.id] }} />{short(s)}</td>
                      <td>{t?.crops.map((c) => `${r.crops[c.crop].label.split(' (')[0]}${c.yield_t ? ` ${c.yield_t} t` : ''}`).join(', ') || 'no harvest'}</td>
                      <td className="mono">{t ? usd(t.profit[1]) : '–'}</td>
                      {r.irrigated && <td className="mono">{t ? Math.round(t.irr) : 0} mm</td>}
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
  const [i, setI] = useState(2)
  const [j, setJ] = useState(1)
  const dT = r.twin.dT[i], dP = r.twin.dP[j]
  const rows = r.strategies.map((s) => {
    const g = r.twin.grid[s.id][i][j], base = r.twin.grid[s.id][0][2]
    return { id: s.id, name: short(s), p50: g.profit[1], err: [g.profit[1] - g.profit[0], g.profit[2] - g.profit[1]], base: base.profit[1], loss: g.loss_years, erosion: g.erosion, irr: g.irr }
  })
  return (
    <section className="sec" id="twin">
      <div className="wrap">
        <h2 className="h-lg">Climate twin: the same field, warmer and drier</h2>
        <p className="lead narrow">
          We shift the {r.years[0]}–{r.years[1]} weather by a temperature and rainfall change and run every rotation again. A scenario, not a forecast:
          the Earth Engine pipeline adds the NEX-GDDP-CMIP6 ensemble range for each cell.
        </p>
        <div className="two">
          <div className="panel">
            <Field label={`Warming: +${dT} °C`}>
              <input type="range" min={0} max={r.twin.dT.length - 1} value={i} onChange={(e) => setI(+e.target.value)} />
            </Field>
            <Field label={`Rainfall: ${dP >= 0 ? '+' : ''}${Math.round(dP * 100)}%`}>
              <input type="range" min={0} max={r.twin.dP.length - 1} value={j} onChange={(e) => setJ(+e.target.value)} />
            </Field>
            <table className="tbl">
              <thead><tr><th>Strategy</th><th>Median profit</th><th>vs today</th><th>Loss years</th><th>Soil loss</th>{r.irrigated && <th>Pumped</th>}</tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td><span className="dot" style={{ background: SC[x.id] }} />{x.name}</td>
                    <td className="mono">{usd(x.p50)}</td>
                    <td className="mono">{usd(x.p50 - x.base)}</td>
                    <td className="mono">{Math.round(x.loss * 100)}%</td>
                    <td className="mono">{x.erosion} t</td>
                    {r.irrigated && <td className="mono">{Math.round(x.irr)} mm</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel chart">
            <h3 className="h-sm">Median profit per hectare, with the 1-in-10 range</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ReferenceLine y={0} stroke="var(--ink)" strokeOpacity={0.4} />
                <Tooltip formatter={(v) => usd(Number(v))} />
                <Bar dataKey="p50" name="Median profit" radius={[4, 4, 0, 0]} isAnimationActive={false}>
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
  const maxE = Math.max(...r.cloud.map((c) => c.metrics.erosion))
  const [eCap, setECap] = useState(maxE)
  const [worst, setWorst] = useState(Math.min(...r.cloud.map((c) => c.metrics.profit[0])))
  const ok = (p: (typeof r.cloud)[number]) => p.metrics.erosion <= eCap + 1e-9 && p.metrics.profit[0] >= worst
  const label = (p: { rotation: string[]; notill: boolean; irrigation?: string }) =>
    p.rotation.map((c) => r.crops[c].label.split(' (')[0]).join(' → ') + (p.notill ? ', no-till' : ', tilled') + (p.irrigation ? `, ${p.irrigation}` : '')
  const pt = (p: (typeof r.cloud)[number]) => ({ x: p.metrics.erosion, y: p.metrics.profit[1], z: p.metrics.dsoc, name: label(p), p10: p.metrics.profit[0] })
  const front = useMemo(() => r.pareto.filter(ok).sort((a, b) => b.metrics.profit[1] - a.metrics.profit[1]), [r, eCap, worst]) // eslint-disable-line react-hooks/exhaustive-deps
  const minWorst = Math.min(...r.cloud.map((c) => c.metrics.profit[0])), maxWorst = Math.max(...r.cloud.map((c) => c.metrics.profit[0]))

  return (
    <section className="sec" id="tradeoffs">
      <div className="wrap">
        <h2 className="h-lg">Trade-off cockpit: {r.pareto.length} rotations nothing beats on every count</h2>
        <p className="lead narrow">
          NSGA-II searched {r.cloud.length} rotations of up to four crops on the reference field, scoring median profit, bad-year profit, soil loss, soil carbon{r.irrigated ? ' and pumping' : ''}. Set your limits; the list keeps what fits.
        </p>
        <div className="row-between filters">
          <label className="field inline"><span className="label">Soil loss at most {eCap.toFixed(2)} t/ha</span>
            <input type="range" min={0} max={maxE} step={maxE / 100} value={eCap} onChange={(e) => setECap(+e.target.value)} /></label>
          <label className="field inline"><span className="label">Bad-year profit at least {usd(worst)}</span>
            <input type="range" min={minWorst} max={maxWorst} step={(maxWorst - minWorst) / 100} value={worst} onChange={(e) => setWorst(+e.target.value)} /></label>
        </div>
        <div className="two">
          <div className="panel chart">
            <h3 className="h-sm">Median profit against soil loss</h3>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis type="number" dataKey="x" name="Soil loss" unit=" t" domain={[0, 'dataMax']} tickFormatter={(v) => (+v).toFixed(1)} tick={{ fontSize: 12 }} stroke="var(--muted)" label={{ value: 'Soil loss, t/ha a year', position: 'insideBottom', offset: -8, fontSize: 12 }} />
                <YAxis type="number" dataKey="y" name="Median profit" tick={{ fontSize: 12 }} stroke="var(--muted)" tickFormatter={(v) => usd(v)} width={64} />
                <ZAxis range={[40, 40]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const d = payload?.[0]?.payload
                  return d ? <div className="tip"><strong>{d.name}</strong><br />median {usd(d.y)}, bad year {usd(d.p10)}<br />soil loss {d.x} t, soil C {d.z > 0 ? '+' : ''}{d.z} t/ha</div> : null
                }} />
                <Scatter name="Searched" data={r.cloud.filter((c) => !ok(c)).map(pt)} fill="var(--grid-strong)" isAnimationActive={false} />
                <Scatter name="Fits your limits" data={r.cloud.filter(ok).map(pt)} fill="var(--muted)" isAnimationActive={false} />
                <Scatter name="Best trade-offs" data={front.map(pt)} fill="var(--ink)" isAnimationActive={false} />
                {r.strategies.map((s) => (
                  <Scatter key={s.id} name={short(s)} data={[{ ...pt({ ...s, metrics: s.metrics }), name: s.name }]} fill={SC[s.id]} shape="diamond" isAnimationActive={false}
                    label={{ dataKey: () => (s.id === 'current' ? 'Now' : s.id), position: 'right', fontSize: 12, fill: 'var(--ink)' }} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            <div className="legend">
              <span><i style={{ background: 'var(--grid-strong)' }} />Searched</span>
              <span><i style={{ background: 'var(--muted)' }} />Fits your limits</span>
              <span><i style={{ background: 'var(--ink)' }} />Best trade-offs</span>
              <span>◆ the four strategies</span>
            </div>
          </div>
          <div className="panel list">
            <h3 className="h-sm">{front.length} best trade-offs inside your limits{front.length > 8 ? ', top 8 by median profit' : ''}</h3>
            <table className="tbl">
              <thead><tr><th>Rotation</th><th>Median</th><th>Bad year</th><th>Soil loss</th><th>ΔC</th>{r.irrigated && <th>Pumped</th>}</tr></thead>
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
            {!front.length && <p className="small muted">Nothing fits both limits. Loosen one of them.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function CarbonWater({ r }: { r: Region }) {
  const [area, setArea] = useState(1000)
  const cur = r.strategies[0]
  return (
    <section className="sec" id="carbon">
      <div className="wrap">
        <h2 className="h-lg">Carbon credits and the water budget</h2>
        <label className="field inline"><span className="label">Farm size: {area.toLocaleString('en-US')} ha</span>
          <input type="range" min={100} max={20000} step={100} value={area} onChange={(e) => setArea(+e.target.value)} /></label>
        <div className="two">
          <div className="panel">
            <h3 className="h-sm">Soil-carbon credits against current practice</h3>
            <table className="tbl">
              <thead><tr><th>Strategy</th><th>t CO2e/ha a year</th><th>$/ha a year</th><th>Farm, $ a year</th></tr></thead>
              <tbody>
                {r.strategies.slice(1).map((s) => (
                  <tr key={s.id}>
                    <td><span className="dot" style={{ background: SC[s.id] }} />{short(s)}</td>
                    <td className="mono">{s.carbon.t_co2_ha_yr}</td>
                    <td className="mono">{usd(s.carbon.usd_ha_yr[0])} to {usd(s.carbon.usd_ha_yr[1])}</td>
                    <td className="mono">{usd(s.carbon.usd_ha_yr[0] * area)} to {usd(s.carbon.usd_ha_yr[1] * area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">
              RothC-26.3 difference to current practice in 0–30 cm, {Math.round(r.assumptions.buffer * 100)}% held back as a buffer, ${r.assumptions.co2_price[0]}–{r.assumptions.co2_price[1]} per tonne.
              A registry (for example Verra VM0042) pays only after measured soil samples and a baseline audit, so read this as an upper bound for a conversation, not income.
            </p>
          </div>
          <div className="panel">
            {r.irrigated ? (
              <>
                <h3 className="h-sm">Groundwater left in the aquifer</h3>
                <table className="tbl">
                  <thead><tr><th>Strategy</th><th>Pumped, mm a year</th><th>Saved, m³/ha</th><th>Farm, acre-feet a year</th></tr></thead>
                  <tbody>
                    {r.strategies.map((s) => (
                      <tr key={s.id}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s)}</td>
                        <td className="mono">{Math.round(s.metrics.irr[1])}</td>
                        <td className="mono">{Math.round(s.water_saved_mm * 10).toLocaleString('en-US')}</td>
                        <td className="mono">{Math.round((s.water_saved_mm * 10 * area) / 1233.5).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">
                  GRACE-FO sees the whole Lower Colorado basin losing stored water (map layer “GRACE-FO water storage”).
                  It cannot see one farm; the pipeline converts the cell trend to mm a year so savings sit on the same scale.
                </p>
              </>
            ) : (
              <>
                <h3 className="h-sm">Where the rain goes on a rain-fed field</h3>
                <table className="tbl">
                  <thead><tr><th>Strategy</th><th>Bare days a year</th><th>Soil loss, t/ha</th><th>Farm, t of soil a year</th></tr></thead>
                  <tbody>
                    {r.strategies.map((s) => (
                      <tr key={s.id}>
                        <td><span className="dot" style={{ background: SC[s.id] }} />{short(s)}</td>
                        <td className="mono">{s.metrics.bare_days}</td>
                        <td className="mono">{s.metrics.erosion}</td>
                        <td className="mono">{Math.round(s.metrics.erosion * area).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">
                  No pumping here: the water question is moisture stored before sowing. Current practice keeps the field bare {cur.metrics.bare_days} days a year to store it.
                  GRACE-FO shows the regional storage trend on the map.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Method({ r }: { r: Region }) {
  return (
    <section className="sec" id="method">
      <div className="wrap">
        <h2 className="h-lg">Method, data and limits</h2>
        <div className="three">
          <div className="panel">
            <h3 className="h-sm">Data in this demo</h3>
            <ul className="list-plain small">
              <li><strong>NASA POWER</strong> daily rain, temperature, wind, {r.years[0] - 1}–{r.years[1] + 1}</li>
              <li><strong>ISRIC SoilGrids 2.0</strong> clay, sand, organic carbon, bulk density, 0–30 cm, per H3 cell</li>
              <li><strong>NASA GIBS</strong> MODIS NDVI, SMAP L4, GPM IMERG, GRACE-FO mascons on the map</li>
              <li><strong>Earth Engine pipeline</strong> (pipeline/gee_layers.py) adds HLS NDVI, SRTM slope, NEX-GDDP-CMIP6 deltas</li>
              <li><strong>ML</strong> crop map and SMAP downscaling come from a separate repository; {r.ml ? `loaded: ${r.ml.model}` : 'not loaded for this region'}</li>
            </ul>
          </div>
          <div className="panel">
            <h3 className="h-sm">Models</h3>
            <ul className="list-plain small">
              <li><strong>Water and yield:</strong> daily FAO-56 soil water balance, FAO-33 yield response, heat stress at flowering, snow trapped by stubble</li>
              <li><strong>Wind erosion:</strong> RWEQ-style index on dry, bare days; water erosion RUSLE</li>
              <li><strong>Soil carbon:</strong> RothC-26.3, monthly</li>
              <li><strong>Search:</strong> NSGA-II (pymoo), up to four crops, tillage{r.irrigated ? ', irrigation method' : ''}</li>
              <li><strong>Prices and costs</strong> are stated assumptions in pipeline/crops.py</li>
            </ul>
          </div>
          <div className="panel">
            <h3 className="h-sm">What this tool will not tell you</h3>
            <ul className="list-plain small">
              <li>A yield promise. Every number is a range over real weather years.</li>
              <li>Your field's own moisture from SMAP: its pixel is 9 km wide.</li>
              <li>What to plant. It lays out trade-offs; you, your agronomist and your buyers decide.</li>
              <li>Absolute soil loss. Erosion values compare rotations on the same field.</li>
            </ul>
          </div>
        </div>
        <div className="panel chart">
          <h3 className="h-sm">Climate of the reference field, NASA POWER monthly means</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={r.climate} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(m) => 'JFMAMJJASOND'[m - 1]} tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" unit=" mm" width={60} />
              <Tooltip />
              <Bar dataKey="rain" name="Rain, mm" fill={SC.current} radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: 'top', fontSize: 0 }} />
              <Bar dataKey="et0" name="Reference ET, mm" fill={SC.A} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend"><span><i style={{ background: SC.current }} />Rain</span><span><i style={{ background: SC.A }} />Reference evapotranspiration</span></div>
        </div>
      </div>
    </section>
  )
}
