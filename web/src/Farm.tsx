import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { IMAGERY, fit } from './MapView'
import { SecHead } from './SecHead'
import type { FarmPlan, FarmResult } from './types'
import { areaHa, download, usd, usePost, useLang, useT, type DrawnField, type Lang } from './fmt'

// Whole-farm plan (POST /farm, pipeline/plan.py): the form under the field list, the result page, the bank report.

type Template = { id: 'az' | 'vko'; name: string; name_ru: string; irrigated: boolean; crops: Record<string, { label: string; label_ru: string; family: string; ymax: number }> }
type ContractRow = { crop: string; min_t: string; max_t: string }

const closed = (ring: [number, number][]) => ({ type: 'Polygon' as const, coordinates: [[...ring, ring[0]]] })
const cropName = (crops: Record<string, { label: string; label_ru?: string }>, c: string, l: Lang) => ((l === 'ru' && crops[c]?.label_ru) || crops[c]?.label || c).split(' (')[0]
const num = (v: number) => Math.round(v).toLocaleString('en-US')

export function FarmForm({ fields, onFarm }: { fields: DrawnField[]; onFarm: (f: FarmResult) => void }) {
  const t = useT(), l = useLang()
  const [tpl, setTpl] = useState<Template | null>(null)
  const [m, setM] = useState({ seed_ha_day: 100, harvest_ha_day: 80, notill: false, drip: false })
  const [exclude, setExclude] = useState<string[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const { busy, err, run } = usePost()
  const pts = fields.flatMap((f) => f.ring)
  const at = `${(pts.reduce((s, p) => s + p[1], 0) / pts.length).toFixed(2)},${(pts.reduce((s, p) => s + p[0], 0) / pts.length).toFixed(2)}`
  const area = fields.reduce((s, f) => s + areaHa(f.ring), 0)

  useEffect(() => {
    const [lat, lon] = at.split(',')
    fetch(`${import.meta.env.BASE_URL}template?lat=${lat}&lon=${lon}`).then((r) => (r.ok ? r.json() : null)).then(setTpl).catch(() => setTpl(null))
  }, [at])

  const crops = tpl ? Object.entries(tpl.crops).filter(([, c]) => c.family !== 'fallow') : []
  const sellable = crops.filter(([, c]) => c.ymax > 0)
  const setC = (i: number, k: keyof ContractRow, v: string) => setContracts(contracts.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const plan = () => run<FarmResult>('farm', {
    fields: fields.map((f) => ({ name: f.name, geometry: closed(f.ring) })),
    machinery: { ...m, drip: m.drip && !!tpl?.irrigated },
    exclude,
    contracts: contracts.filter((c) => c.crop && (c.min_t || c.max_t)).map((c) => ({ crop: c.crop, min_t: c.min_t ? +c.min_t : null, max_t: c.max_t ? +c.max_t : null })),
  }, onFarm, t('Could not plan the farm', 'Не удалось составить план'))

  return (
    <div className="panel farm-form">
      <div className="row-between">
        <h3 className="h-md">{t(`Farm plan: ${fields.length} fields, ${num(area)} ha`, `План хозяйства: полей ${fields.length}, ${num(area)} га`)}</h3>
        {tpl && <span className="small muted">{t(`Crops and prices of ${tpl.name}`, `Культуры и цены: ${tpl.name_ru}`)}</span>}
      </div>
      <p className="small muted">{t('NSGA-II gives every field a rotation and a start year so that the farm as a whole fits the drill, the combine and the contracts, then shows the best plans for profit, a bad year, soil and carbon.',
        'NSGA-II назначает каждому полю севооборот и год старта так, чтобы хозяйство целиком укладывалось в сеялку, комбайн и контракты, и показывает лучшие планы по прибыли, плохому году, почве и углероду.')}</p>
      <div className="farm-grid">
        <fieldset>
          <legend className="label">{t('Machinery', 'Техника')}</legend>
          <label className="field">{t('Drill, ha a day', 'Сеялка, га в день')}
            <input type="number" min={1} max={5000} value={m.seed_ha_day} onChange={(e) => setM({ ...m, seed_ha_day: +e.target.value })} /></label>
          <label className="field">{t('Combine, ha a day', 'Комбайн, га в день')}
            <input type="number" min={1} max={5000} value={m.harvest_ha_day} onChange={(e) => setM({ ...m, harvest_ha_day: +e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={m.notill} onChange={(e) => setM({ ...m, notill: e.target.checked })} />{t('No-till drill', 'Сеялка прямого посева')}</label>
          {tpl?.irrigated && <label className="check"><input type="checkbox" checked={m.drip} onChange={(e) => setM({ ...m, drip: e.target.checked })} />{t('Drip irrigation installed', 'Капельный полив есть')}</label>}
          <p className="small muted">{t(`The drill covers the whole farm in ${Math.ceil(area / Math.max(1, m.seed_ha_day))} days; a month has 20 work days.`, `Сеялка проходит всё хозяйство за ${Math.ceil(area / Math.max(1, m.seed_ha_day))} дн.; в месяце 20 рабочих дней.`)}</p>
        </fieldset>
        <fieldset>
          <legend className="label">{t('Crops the farm can grow and sell', 'Культуры, которые хозяйство может растить и продать')}</legend>
          <div className="checks">
            {crops.map(([k, c]) => (
              <label key={k} className="check"><input type="checkbox" checked={!exclude.includes(k)}
                onChange={(e) => setExclude(e.target.checked ? exclude.filter((x) => x !== k) : [...exclude, k])} />{(l === 'ru' && c.label_ru) || c.label}</label>
            ))}
            {!tpl && <p className="small muted">{t('Loading the crop list', 'Загружаем список культур')}</p>}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">{t('Sales contracts, tonnes a year', 'Контракты на продажу, тонн в год')}</legend>
          {contracts.map((c, i) => (
            <div key={i} className="contract">
              <select aria-label={t('Crop', 'Культура')} value={c.crop} onChange={(e) => setC(i, 'crop', e.target.value)}>
                <option value="">{t('Crop', 'Культура')}</option>
                {sellable.map(([k, x]) => <option key={k} value={k}>{(l === 'ru' && x.label_ru) || x.label}</option>)}
              </select>
              <input type="number" min={0} placeholder={t('at least', 'не меньше')} aria-label={t('At least, t', 'Не меньше, т')} value={c.min_t} onChange={(e) => setC(i, 'min_t', e.target.value)} />
              <input type="number" min={0} placeholder={t('at most', 'не больше')} aria-label={t('At most, t', 'Не больше, т')} value={c.max_t} onChange={(e) => setC(i, 'max_t', e.target.value)} />
              <button className="btn btn-ghost btn-sm" aria-label={t('Remove contract', 'Убрать контракт')} onClick={() => setContracts(contracts.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={!tpl || contracts.length >= 10} onClick={() => setContracts([...contracts, { crop: '', min_t: '', max_t: '' }])}>{t('Add a contract', 'Добавить контракт')}</button>
          <p className="small muted">{t('Planned on median yields, so the plan holds in a typical year; the result shows how often the real harvest would have met it.', 'Считается по медианному урожаю, то есть на обычный год; в результате видно, как часто реальный урожай выполнил бы контракт.')}</p>
        </fieldset>
      </div>
      <div className="row-between">
        <p className="small" role="status" aria-live="polite">{busy ? t('Weather and soil for every field, about 300 rotations each, then the farm search. A minute or two.', 'Погода и почва каждого поля, около 300 севооборотов на поле, потом поиск по хозяйству. Минута-две.') : err}</p>
        <button className="btn btn-solid" disabled={busy > 0 || !tpl} onClick={plan}>{busy ? t(`Planning, ${busy} s`, `Составляем план, ${busy} с`) : t('Plan the farm', 'Составить план хозяйства')}</button>
      </div>
    </div>
  )
}

const GOALS: Record<FarmPlan['key'], [string, string]> = {
  balanced: ['Balanced', 'Сбалансированный'], profit: ['Most profit', 'Больше прибыли'], safe: ['Safest bad year', 'Надёжнее в плохой год'],
  soil: ['Least soil loss', 'Меньше эрозии'], carbon: ['Most soil carbon', 'Больше углерода'], water: ['Least water', 'Меньше воды'],
  current: ['Current practice', 'Как сейчас'], closest: ['Closest, does not fit', 'Ближайший, не укладывается'],
}
const ROT_COLOURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#8e6cf0', '#e05a9a', '#3fbfbf', '#b07b4f']
const MONTHS: [string, string][] = [['Jan', 'янв'], ['Feb', 'фев'], ['Mar', 'мар'], ['Apr', 'апр'], ['May', 'май'], ['Jun', 'июн'], ['Jul', 'июл'], ['Aug', 'авг'], ['Sep', 'сен'], ['Oct', 'окт'], ['Nov', 'ноя'], ['Dec', 'дек']]

const goal = (p: FarmPlan, l: Lang) => GOALS[p.key][l === 'ru' ? 1 : 0]
const rotKey = (f: FarmPlan['fields'][number]) => `${f.rotation.join('>')}|${f.notill}|${f.irrigation}`
const pct = (v: number) => `${Math.round(v * 100)}%`
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`

export default function FarmPlanView({ farm, onBack }: { farm: FarmResult; onBack: () => void }) {
  const t = useT(), l = useLang()
  const all = [...farm.plans, farm.baseline]
  const [key, setKey] = useState(farm.plans[0].key)
  const [pay, setPay] = useState('')
  const p = all.find((x) => x.key === key) ?? farm.plans[0]
  const base = farm.baseline
  const rots = [...new Set(p.fields.map(rotKey))]
  const colour = (f: FarmPlan['fields'][number]) => ROT_COLOURS[rots.indexOf(rotKey(f)) % ROT_COLOURS.length]
  const crop = (c: string) => cropName(farm.crops, c, l)
  const rotation = (f: FarmPlan['fields'][number]) => f.rotation.map(crop).join(' → ')
  const practice = (f: FarmPlan['fields'][number]) => (f.notill ? 'no-till' : t('tilled', 'вспашка')) + (f.irrigation ? `, ${f.irrigation === 'drip' ? t('drip', 'капельный') : t('flood', 'напуск')}` : '')
  const irrigated = all.some((x) => x.irr_m3 > 0)
  const planCrops = [...new Set(p.plan_years.flatMap((y) => Object.keys(y.crops)))]
  const busyMonths = MONTHS.map((_, i) => i).filter((i) => p.machinery.sow[i] > 0 || p.machinery.harvest[i] > 0)
  const payment = +pay > 0 ? +pay : 0
  const cover = payment ? debt(p, payment) : null
  const fits = (x: FarmPlan) => (x.feasible ? t('yes', 'да')
    : [x.overload_days ? t(`machinery ${x.overload_days} days over in the busiest month`, `технике не хватает ${x.overload_days} дн. в пиковый месяц`) : '', x.shortfall_t ? t(`${num(x.shortfall_t)} t off a contract in the worst year`, `контракт: ${num(x.shortfall_t)} т в худший год`) : ''].filter(Boolean).join(', '))

  const yearsCsv = () => download('furrow-farm-years.csv', [
    ['plan', 'weather_year', 'revenue_usd', 'cost_usd', 'profit_usd'],
    ...all.flatMap((x) => x.years.map(([y, pr, rev, c]) => [x.key, y, rev, c, pr])),
  ])
  const fieldsCsv = () => download('furrow-farm-fields.csv', [
    ['plan', 'field', 'area_ha', 'rotation', 'practice', ...p.plan_years.map((_, i) => `year_${i + 1}`), 'profit_p10_usd_ha', 'profit_p50_usd_ha', 'profit_p90_usd_ha'],
    ...all.flatMap((x) => x.fields.map((f, i) => [x.key, farm.fields[i].name, farm.fields[i].area, f.rotation.join(' > '), practice(f), ...f.years.map((y) => y.join('+') || '-'), ...f.profit])),
  ])

  return (
    <section className="sec" id="farm">
      <div className="wrap no-print">
        <div className="row-between">
          <SecHead title={t(`Farm plan: ${farm.fields.length} fields, ${num(farm.area)} ha`, `План хозяйства: полей ${farm.fields.length}, ${num(farm.area)} га`)}
            sub={t(`Replayed over ${farm.years[0]}–${farm.years[1]} weather. ${farm.options} rotation choices per field; drill ${farm.machinery.seed_ha_day} ha a day, combine ${farm.machinery.harvest_ha_day} ha a day.`,
              `Прогон по погоде ${farm.years[0]}–${farm.years[1]}. Вариантов севооборота на поле: ${farm.options}; сеялка ${farm.machinery.seed_ha_day} га в день, комбайн ${farm.machinery.harvest_ha_day} га в день.`)} />
          <button className="btn btn-ghost" onClick={onBack}>{t('Back to the fields', 'Назад к полям')}</button>
        </div>

        {!farm.plans.some((x) => x.feasible) && (
          <p className="panel warn" role="alert">{t('No plan fits the machinery and the contracts. Below is the closest one and by how much it misses: a bigger drill or combine, or a smaller contract, would make room.',
            'Ни один план не укладывается в технику и контракты. Ниже — ближайший и на сколько он промахивается: место освободит сеялка или комбайн мощнее либо контракт поменьше.')}</p>
        )}

        <div className="panel">
          <h3 className="h-sm">{t('Plans for the whole farm, a year', 'Планы на всё хозяйство, в год')}</h3>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>{t('Plan', 'План')}</th><th>{t('Median profit', 'Медиана прибыли')}</th><th>{t('Bad year (1 in 10)', 'Плохой год (1 из 10)')}</th><th>{t('Loss years', 'Убыточных лет')}</th><th>{t('Soil loss, t', 'Эрозия, т')}</th><th>{t('Soil C vs now, t', 'Углерод к текущей, т')}</th>{irrigated && <th>{t('Pumped, m³', 'Откачка, м³')}</th>}<th>{t('Contracts met', 'Контракты выполнены')}</th><th>{t('Fits', 'Укладывается')}</th></tr></thead>
              <tbody>
                {all.map((x) => (
                  <tr key={x.key} aria-selected={x.key === p.key} tabIndex={0} onClick={() => setKey(x.key)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setKey(x.key)}>
                    <td>{goal(x, l)}{x.also?.length ? <span className="muted"> · {x.also.map((k) => GOALS[k as FarmPlan['key']]?.[l === 'ru' ? 1 : 0]).join(', ')}</span> : null}</td>
                    <td className="mono">{usd(x.profit[1])}</td>
                    <td className="mono">{usd(x.profit[0])}</td>
                    <td className="mono">{pct(x.loss_years)}</td>
                    <td className="mono">{num(x.erosion)}</td>
                    <td className="mono">{x.key === 'current' ? '–' : signed(x.dsoc - base.dsoc)}</td>
                    {irrigated && <td className="mono">{num(x.irr_m3)}</td>}
                    <td className="mono">{x.contracts.length ? pct(Math.min(...x.contracts.map((c) => c.met_share))) : '–'}</td>
                    <td>{fits(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{t('Click a plan to see it field by field. Contracts met: the share of weather years the real harvest reached every contract.', 'Нажмите на план, чтобы увидеть его по полям. Контракты выполнены: доля погодных лет, когда реальный урожай покрыл все контракты.')}</p>
        </div>

        <div className="two" style={{ marginTop: 16 }}>
          <div className="map-wrap">
            <FarmMap farm={farm} colours={p.fields.map(colour)} />
            <div className="map-legend farm-legend">
              {rots.map((k, i) => { const f = p.fields.find((x) => rotKey(x) === k)!; return (
                <p key={k} className="small"><i style={{ background: ROT_COLOURS[i % ROT_COLOURS.length] }} />{rotation(f)}, {practice(f)}</p>
              ) })}
            </div>
          </div>
          <div className="tiles">
            <div className="tile tile-blue"><strong>{usd(p.profit[1])}</strong><span>{t(`Median profit a year, ${goal(p, l).toLowerCase()}`, `Медиана прибыли в год, ${goal(p, l).toLowerCase()}`)}</span></div>
            <div className="tile tile-ink"><strong>{p.profit[1] >= base.profit[1] ? '+' : ''}{usd(p.profit[1] - base.profit[1])}</strong><span>{t('vs current practice', 'к текущей практике')}</span></div>
            <div className="tile tile-grey"><strong>{usd(p.worst[1])}</strong><span>{t(`Worst year, ${p.worst[0]} weather`, `Худший год, погода ${p.worst[0]}`)}</span></div>
            <div className="tile tile-white"><strong>{usd(p.stress.profit[1])}</strong><span>{t('Median at +2 °C, 10% less rain', 'Медиана при +2 °C и −10% осадков')}</span></div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="row-between"><h3 className="h-sm">{t('Field by field', 'По полям')}</h3><button className="btn btn-ghost btn-sm" onClick={fieldsCsv}>{t('Fields, CSV', 'Поля, CSV')}</button></div>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>{t('Field', 'Поле')}</th><th>{t('ha', 'га')}</th><th>{t('Rotation', 'Севооборот')}</th>{p.plan_years.map((_, i) => <th key={i}>{t(`Year ${i + 1}`, `Год ${i + 1}`)}</th>)}<th>{t('Profit, $/ha', 'Прибыль, $/га')}</th></tr></thead>
              <tbody>
                {p.fields.map((f, i) => (
                  <tr key={i}>
                    <td><span className="dot" style={{ background: colour(f) }} />{farm.fields[i].name}</td>
                    <td className="mono">{num(farm.fields[i].area)}</td>
                    <td>{rotation(f)}<br /><span className="small muted">{practice(f)}</span></td>
                    {f.years.map((y, k) => <td key={k}>{y.map(crop).join(', ') || '–'}</td>)}
                    <td className="mono">{usd(f.profit[1])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="two" style={{ marginTop: 16 }}>
          <div className="panel">
            <h3 className="h-sm">{t('Crop areas and planned tonnes by year', 'Площади и плановый сбор по годам')}</h3>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>{t('Crop', 'Культура')}</th>{p.plan_years.map((_, i) => <th key={i}>{t(`Y${i + 1}`, `Г${i + 1}`)}</th>)}</tr></thead>
                <tbody>
                  {planCrops.map((c) => (
                    <tr key={c}><td>{crop(c)}</td>{p.plan_years.map((y, i) => (
                      <td key={i} className="mono">{y.crops[c] ? <>{num(y.crops[c])} {t('ha', 'га')}{y.tons[c] ? <><br /><span className="muted">{num(y.tons[c])} {t('t', 'т')}</span></> : null}</> : '–'}</td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.contracts.length > 0 && (
              <table className="tbl" style={{ marginTop: 12 }}>
                <thead><tr><th>{t('Contract', 'Контракт')}</th><th>{t('Planned, t a year', 'План, т в год')}</th><th>{t('Met by the real harvest', 'Реальный урожай выполнил')}</th></tr></thead>
                <tbody>
                  {p.contracts.map((c, i) => (
                    <tr key={i}><td>{crop(c.crop)} {c.min_t != null ? `≥ ${num(c.min_t)}` : ''} {c.max_t != null ? `≤ ${num(c.max_t)}` : ''}</td>
                      <td className="mono">{num(c.planned[0])}–{num(c.planned[1])}</td><td className="mono">{pct(c.met_share)} {t('of years', 'лет')}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel">
            <h3 className="h-sm">{t(`Machinery: days of work a month, out of ${p.machinery.work_days}`, `Техника: дней работы в месяц из ${p.machinery.work_days}`)}</h3>
            <table className="tbl">
              <thead><tr><th>{t('Month', 'Месяц')}</th><th>{t('Drill', 'Сеялка')}</th><th>{t('Combine', 'Комбайн')}</th></tr></thead>
              <tbody>
                {busyMonths.map((i) => (
                  <tr key={i}><td>{MONTHS[i][l === 'ru' ? 1 : 0]}</td>
                    <td className={`mono${p.machinery.sow[i] > p.machinery.work_days ? ' over' : ''}`}>{p.machinery.sow[i] || '–'}</td>
                    <td className={`mono${p.machinery.harvest[i] > p.machinery.work_days ? ' over' : ''}`}>{p.machinery.harvest[i] || '–'}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">{t('The busiest year of the replay. Hay is mown, not combined; fallow tillage is not counted.', 'Самый загруженный год прогона. Сено косят, а не убирают комбайном; обработка пара не считается.')}</p>
          </div>
        </div>

        <div className="panel bank" style={{ marginTop: 16 }}>
          <h3 className="h-sm">{t('Report for the bank', 'Отчёт для банка')}</h3>
          <p className="small muted">{t('The chosen plan as a lender reads it: cash flow over every weather year, the bad year, a +2 °C stress test, contracts and machinery. Add the yearly loan payment to see how often the plan covers it.',
            'Выбранный план так, как его читает кредитор: денежный поток по каждому погодному году, плохой год, стресс-тест +2 °C, контракты и техника. Укажите годовой платёж по кредиту, чтобы увидеть, как часто план его покрывает.')}</p>
          <div className="row-between">
            <label className="field inline">{t('Loan payment, $ a year', 'Платёж по кредиту, $ в год')}
              <input type="number" min={0} step={1000} value={pay} placeholder="0" onChange={(e) => setPay(e.target.value)} /></label>
            {cover && <p className="small">{t(`Covered in ${cover.covered} of ${cover.n} years; coverage ratio median ${cover.median}, worst ${cover.min}.`, `Покрыт в ${cover.covered} из ${cover.n} лет; коэффициент покрытия: медиана ${cover.median}, худший ${cover.min}.`)}</p>}
            <div className="btns">
              <button className="btn btn-solid" onClick={() => print()}>{t('Save the bank report as PDF', 'Сохранить отчёт для банка в PDF')}</button>
              <button className="btn btn-ghost" onClick={yearsCsv}>{t('Cash flow by year, CSV', 'Денежный поток по годам, CSV')}</button>
            </div>
          </div>
        </div>
      </div>

      <BankReport farm={farm} p={p} payment={payment} />
    </section>
  )
}

function debt(p: FarmPlan, payment: number) {
  const r = p.years.map((y) => y[1] / payment).sort((a, b) => a - b)
  const f = (v: number) => v.toFixed(2)
  return { n: r.length, covered: r.filter((x) => x >= 1).length, min: f(r[0]), median: f(r[Math.floor(r.length / 2)]) }
}

function FarmMap({ farm, colours }: { farm: FarmResult; colours: string[] }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const data = () => ({
    type: 'FeatureCollection' as const,
    features: farm.fields.map((f, i) => ({ type: 'Feature' as const, properties: { c: colours[i] }, geometry: closed(f.ring) })),
  })
  const latest = useRef(data)
  useEffect(() => { latest.current = data })

  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current!, style: IMAGERY, attributionControl: { compact: true }, cooperativeGestures: true })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    fit(m, farm.fields.flatMap((f) => f.ring))
    m.on('load', () => {
      m.addSource('farm', { type: 'geojson', data: latest.current() })
      m.addLayer({ id: 'farm-fill', type: 'fill', source: 'farm', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.55 } })
      m.addLayer({ id: 'farm-line', type: 'line', source: 'farm', paint: { 'line-color': '#ffffff', 'line-width': 1.5 } })
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(box.current!)
    return () => { ro.disconnect(); m.remove() }
  }, [farm])

  useEffect(() => { (map.current?.getSource('farm') as maplibregl.GeoJSONSource | undefined)?.setData(data()) }, [colours.join()]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="map" role="region" aria-label={t('Map of the farm, fields coloured by rotation', 'Карта хозяйства, поля по цвету севооборота')} />
}

// Printed only: what a lender asks for, from the plan chosen on screen. Built like Report.tsx (browser "Save as PDF").
function BankReport({ farm, p, payment }: { farm: FarmResult; p: FarmPlan; payment: number }) {
  const t = useT(), l = useLang()
  const base = farm.baseline
  const crop = (c: string) => cropName(farm.crops, c, l)
  const today = new Date().toISOString().slice(0, 10)
  const pts = farm.fields.flatMap((f) => f.ring)
  const lat = pts.reduce((s, q) => s + q[1], 0) / pts.length, lon = pts.reduce((s, q) => s + q[0], 0) / pts.length
  const mean = (k: 1 | 2 | 3, x: FarmPlan) => x.years.reduce((s, y) => s + y[k], 0) / x.years.length
  const cover = payment ? debt(p, payment) : null
  const row = (x: FarmPlan) => [usd(mean(2, x)), usd(mean(3, x)), usd(x.profit[0]), usd(x.profit[1]), usd(x.profit[2]), pct(x.loss_years), `${x.worst[0]}: ${usd(x.worst[1])}`]
  return (
    <article className="doc print-only">
      <header className="doc-head">
        <p className="label">Furrow · {t('farm plan for a lender', 'план хозяйства для кредитора')} · {today}</p>
        <h3 className="h-md">{t(`Farm of ${farm.fields.length} fields, ${num(farm.area)} ha`, `Хозяйство: полей ${farm.fields.length}, ${num(farm.area)} га`)}</h3>
        <p className="small mono">
          {lat.toFixed(3)}, {lon.toFixed(3)} · {t('plan', 'план')}: {goal(p, l)} · NASA POWER {farm.years[0]}–{farm.years[1]} ·
          {' '}{t('drill', 'сеялка')} {farm.machinery.seed_ha_day} {t('ha/day', 'га/день')}, {t('combine', 'комбайн')} {farm.machinery.harvest_ha_day} {t('ha/day', 'га/день')}
          {farm.machinery.notill ? `, ${t('no-till drill', 'сеялка прямого посева')}` : ''}{farm.machinery.drip ? `, ${t('drip', 'капельный полив')}` : ''}
        </p>
      </header>

      <h4>1. {t('Cash flow, whole farm, $ a year', 'Денежный поток, всё хозяйство, $ в год')}</h4>
      <table className="tbl">
        <thead><tr><th /><th>{t('Revenue', 'Выручка')}</th><th>{t('Operating cost', 'Прямые затраты')}</th><th>{t('Margin P10', 'Маржа P10')}</th><th>P50</th><th>P90</th><th>{t('Loss years', 'Убыт. лет')}</th><th>{t('Worst year', 'Худший год')}</th></tr></thead>
        <tbody>
          <tr><td>{goal(p, l)}</td>{row(p).map((v, i) => <td key={i} className="mono">{v}</td>)}</tr>
          {p.key !== 'current' && <tr><td>{goal(base, l)}</td>{row(base).map((v, i) => <td key={i} className="mono">{v}</td>)}</tr>}
        </tbody>
      </table>

      <div className="doc-two">
        <div>
          <h4>2. {t('Debt service', 'Обслуживание долга')}</h4>
          {cover ? (
            <p className="small">{t(`A payment of ${usd(payment)} a year is covered by the margin in ${cover.covered} of ${cover.n} weather years. Coverage ratio: median ${cover.median}, worst year ${cover.min}.`,
              `Платёж ${usd(payment)} в год покрывается маржой в ${cover.covered} из ${cover.n} погодных лет. Коэффициент покрытия: медиана ${cover.median}, худший год ${cover.min}.`)}</p>
          ) : <p className="small">{t('No loan payment entered.', 'Платёж по кредиту не указан.')}</p>}
        </div>
        <div>
          <h4>3. {t(`Stress test: +${p.stress.dT} °C, ${Math.round(-p.stress.dP * 100)}% less rain`, `Стресс-тест: +${p.stress.dT} °C, осадков на ${Math.round(-p.stress.dP * 100)}% меньше`)}</h4>
          <p className="small">{t(`Margin P10 ${usd(p.stress.profit[0])}, median ${usd(p.stress.profit[1])} (today ${usd(p.profit[1])}); loss years ${pct(p.stress.loss_years)}.`,
            `Маржа P10 ${usd(p.stress.profit[0])}, медиана ${usd(p.stress.profit[1])} (сейчас ${usd(p.profit[1])}); убыточных лет ${pct(p.stress.loss_years)}.`)}</p>
        </div>
      </div>

      <h4>4. {t('Fields and rotations', 'Поля и севообороты')}</h4>
      <table className="tbl">
        <thead><tr><th>{t('Field', 'Поле')}</th><th>{t('ha', 'га')}</th><th>{t('Soil: clay, sand, SOC', 'Почва: глина, песок, SOC')}</th><th>{t('Rotation', 'Севооборот')}</th><th>{t('Years 1–3', 'Годы 1–3')}</th><th>{t('Margin P10 · P50, $/ha', 'Маржа P10 · P50, $/га')}</th></tr></thead>
        <tbody>
          {p.fields.map((f, i) => { const fd = farm.fields[i]; return (
            <tr key={i}><td>{fd.name}</td><td className="mono">{num(fd.area)}</td>
              <td className="mono">{fd.soil.clay.toFixed(0)}%, {fd.soil.sand.toFixed(0)}%, {fd.soil.soc.toFixed(1)} {t('g/kg', 'г/кг')}</td>
              <td>{f.rotation.map(crop).join(' → ')}{f.notill ? ', no-till' : ''}</td>
              <td>{f.years.slice(0, 3).map((y) => y.map(crop).join('+') || '–').join(' · ')}</td>
              <td className="mono">{usd(f.profit[0])} · {usd(f.profit[1])}</td></tr>
          ) })}
        </tbody>
      </table>

      <div className="doc-two">
        <div>
          <h4>5. {t('Contracts', 'Контракты')}</h4>
          {p.contracts.length ? (
            <table className="tbl">
              <thead><tr><th>{t('Crop', 'Культура')}</th><th>{t('Terms, t', 'Условия, т')}</th><th>{t('Planned, t', 'План, т')}</th><th>{t('Met', 'Выполнен')}</th></tr></thead>
              <tbody>{p.contracts.map((c, i) => (
                <tr key={i}><td>{crop(c.crop)}</td><td className="mono">{c.min_t != null ? `≥ ${num(c.min_t)}` : ''} {c.max_t != null ? `≤ ${num(c.max_t)}` : ''}</td>
                  <td className="mono">{num(c.planned[0])}–{num(c.planned[1])}</td><td className="mono">{pct(c.met_share)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="small">{t('None entered.', 'Не указаны.')}</p>}
        </div>
        <div>
          <h4>6. {t('Machinery and soil', 'Техника и почва')}</h4>
          <p className="small">{t(`Busiest month: drill ${p.machinery.sow_peak}, combine ${p.machinery.harvest_peak} of ${p.machinery.work_days} work days. Soil loss ${num(p.erosion)} t a year (current practice ${num(base.erosion)}). Soil carbon ${signed(p.dsoc - base.dsoc)} t C a year against current practice.`,
            `Самый загруженный месяц: сеялка ${p.machinery.sow_peak}, комбайн ${p.machinery.harvest_peak} из ${p.machinery.work_days} рабочих дней. Эрозия ${num(p.erosion)} т в год (сейчас ${num(base.erosion)}). Почвенный углерод ${signed(p.dsoc - base.dsoc)} т C в год к текущей практике.`)}</p>
        </div>
      </div>

      <h4>7. {t('Every weather year, $', 'Каждый погодный год, $')}</h4>
      <div className="doc-two">
        {[p.years.slice(0, Math.ceil(p.years.length / 2)), p.years.slice(Math.ceil(p.years.length / 2))].map((half, k) => (
          <table key={k} className="tbl doc-years">
            <thead><tr><th>{t('Weather', 'Погода')}</th><th>{t('Revenue', 'Выручка')}</th><th>{t('Cost', 'Затраты')}</th><th>{t('Margin', 'Маржа')}</th>{payment > 0 && <th>{t('Cover', 'Покр.')}</th>}</tr></thead>
            <tbody>{half.map(([y, pr, rev, c]) => (
              <tr key={y}><td className="mono">{y}</td><td className="mono">{usd(rev)}</td><td className="mono">{usd(c)}</td><td className="mono">{usd(pr)}</td>{payment > 0 && <td className="mono">{(pr / payment).toFixed(2)}</td>}</tr>
            ))}</tbody>
          </table>
        ))}
      </div>

      <p className="small doc-foot">
        {t('Margin is revenue less direct crop costs (seed, fertiliser, fuel, operations, pumped water); land rent, labour overheads, depreciation and taxes are not in it. Yields are a model replay of each past weather year on SoilGrids soil, not a forecast. Prices, costs and 20 work days a month are stated assumptions. ',
          'Маржа — выручка минус прямые затраты на культуру (семена, удобрения, топливо, операции, откачка воды); аренда земли, накладные расходы, амортизация и налоги в неё не входят. Урожай — модельный прогон каждого прошлого погодного года на почве SoilGrids, а не прогноз. Цены, затраты и 20 рабочих дней в месяц — явные допущения. ')}
        NASA POWER, ISRIC SoilGrids 2.0, FAO-56, FAO-33, RWEQ/RUSLE, RothC-26.3, NSGA-II.
      </p>
    </article>
  )
}
