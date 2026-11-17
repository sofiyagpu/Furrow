import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { IMAGERY, fit } from './MapView'
import { SecHead } from './SecHead'
import { FarmForm } from './Farm'
import type { Feature } from 'geojson'
import type { FarmResult, Region } from './types'
import { areaHa, usePost, useT, type DrawnField, type Pt } from './fmt'

const ringOf = (c?: Element) => {
  const pts = (c?.textContent ?? '').trim().split(/\s+/).map((s) => s.split(',').map(Number))
    .filter((p) => p.length >= 2 && p.every(Number.isFinite)).map(([x, y]) => [x, y] as Pt)
  const last = pts.at(-1)
  if (pts.length > 1 && last && last[0] === pts[0][0] && last[1] === pts[0][1]) pts.pop()
  return pts
}

// every Polygon in a KML file, named by its Placemark; outer ring only, unclosed. KMZ is a zip: not read.
function kmlFields(text: string): DrawnField[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const marks = [...doc.getElementsByTagNameNS('*', 'Placemark')]
  return (marks.length ? marks : [doc]).flatMap((m) => {
    const name = marks.length ? m.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim() ?? '' : ''
    return [...m.getElementsByTagNameNS('*', 'Polygon')].map((p) => ({ name, ring: ringOf(p.getElementsByTagNameNS('*', 'outerBoundaryIs')[0] ?? p) }))
  }).filter((f) => f.ring.length >= 3)
}

const closed = (ring: Pt[]) => ({ type: 'Polygon' as const, coordinates: [[...ring, ring[0]]] })

function shape(pts: Pt[], fields: DrawnField[]) {
  const f: Feature[] = fields.map((x) => ({ type: 'Feature', properties: { kind: 'field' }, geometry: closed(x.ring) }))
  f.push(...pts.map((p): Feature => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })))
  if (pts.length >= 3) f.push({ type: 'Feature', properties: {}, geometry: closed(pts) })
  else if (pts.length === 2) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } })
  return { type: 'FeatureCollection' as const, features: f }
}

type P = { fields: DrawnField[]; setFields: (f: DrawnField[]) => void; onField: (r: Region) => void; onFarm: (f: FarmResult) => void }

// Outline fields (click the corners, or load KML). One field -> POST /field; two or more -> the farm form, POST /farm.
export default function FieldInput({ fields, setFields, onField, onFarm }: P) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [pts, setPts] = useState<Pt[]>([])
  const { busy, err, setErr, run } = usePost()
  const latest = useRef({ pts, fields, busy })
  useEffect(() => { latest.current = { pts, fields, busy } }, [pts, fields, busy])

  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current!, style: IMAGERY, center: [67, 48.5], zoom: 4, doubleClickZoom: false, attributionControl: { compact: true }, cooperativeGestures: true })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('draw', { type: 'geojson', data: shape(latest.current.pts, latest.current.fields) })
      const isField: maplibregl.ExpressionSpecification = ['==', ['get', 'kind'], 'field']
      m.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['case', isField, '#4fb3ff', '#ffffff'], 'fill-opacity': 0.2 } })
      m.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': ['case', isField, '#4fb3ff', '#ffffff'], 'line-width': 2 } })
      m.addLayer({ id: 'draw-pt', type: 'circle', source: 'draw', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#232323', 'circle-stroke-width': 1.5 } })
    })
    m.on('click', (e) => { if (!latest.current.busy) setPts((p) => [...p, [+e.lngLat.lng.toFixed(5), +e.lngLat.lat.toFixed(5)]]) })
    m.getCanvas().style.cursor = 'crosshair'
    map.current = m
    const ro = new ResizeObserver(() => m.resize()) // the container can get its size after the map is made
    ro.observe(box.current!)
    if (latest.current.fields.length) fit(m, latest.current.fields.flatMap((f) => f.ring)) // back from a farm plan
    return () => { ro.disconnect(); m.remove() }
  }, [])

  useEffect(() => { (map.current?.getSource('draw') as maplibregl.GeoJSONSource | undefined)?.setData(shape(pts, fields)) }, [pts, fields])

  const onFile = async (f?: File) => {
    if (!f) return
    const got = kmlFields(await f.text())
    if (!got.length) { setErr(t('No field outline found in this KML file', 'В этом KML-файле нет контура поля')); return }
    setErr('')
    setFields([...fields, ...got])
    if (map.current) fit(map.current, got.flatMap((x) => x.ring))
  }

  const calc = (ring: Pt[]) => run<Region>('field', closed(ring), onField, t('Could not calculate the field', 'Не удалось посчитать поле'))

  return (
    <section className="sec">
      <div className="wrap">
        <SecHead title={t('Your fields', 'Ваши поля')}
          sub={t('Click the corners of a field on the map, or load outlines from KML. One field: its strategies in about a minute. Two or more: a plan for the whole farm under your machinery and contracts.',
            'Отметьте углы поля на карте или загрузите контуры из KML. Одно поле — его стратегии примерно за минуту. Два и больше — план на всё хозяйство с учётом техники и контрактов.')} />
        <div className="map-grid">
          <div className="map-wrap"><div ref={box} className="map" role="region" aria-label={t('Map to outline fields', 'Карта для контуров полей')} /></div>
          <div className="panel field-side">
            <p className="small">{pts.length < 3
              ? t(`Corners marked: ${pts.length}. At least 3 are needed.`, `Отмечено углов: ${pts.length}. Нужно хотя бы 3.`)
              : t(`Outline of ${pts.length} corners, ${Math.round(areaHa(pts))} ha.`, `Контур из ${pts.length} углов, ${Math.round(areaHa(pts))} га.`)}</p>
            <div className="btns">
              <button className="btn btn-ghost btn-sm" disabled={!pts.length || busy > 0} onClick={() => setPts((p) => p.slice(0, -1))}>{t('Undo corner', 'Убрать угол')}</button>
              <button className="btn btn-ghost btn-sm" disabled={!pts.length || busy > 0} onClick={() => setPts([])}>{t('Clear', 'Очистить')}</button>
              <label className="btn btn-ghost btn-sm">{t('Load KML', 'Загрузить KML')}
                <input type="file" accept=".kml,application/vnd.google-earth.kml+xml" className="sr-only" disabled={busy > 0}
                  onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
            <div className="btns">
              <button className="btn btn-solid" disabled={pts.length < 3 || busy > 0} onClick={() => calc(pts)}>
                {busy ? t(`Calculating, ${busy} s`, `Считаем, ${busy} с`) : t('Strategies for this field', 'Стратегии для этого поля')}
              </button>
              <button className="btn btn-ghost" disabled={pts.length < 3 || busy > 0} onClick={() => { setFields([...fields, { name: '', ring: pts }]); setPts([]) }}>
                {t('Add to the farm', 'Добавить в хозяйство')}
              </button>
            </div>
            {fields.length > 0 && (
              <ul className="field-list" aria-label={t('Farm fields', 'Поля хозяйства')}>
                {fields.map((f, i) => (
                  <li key={i}>
                    <input className="input" value={f.name} placeholder={t(`Field ${i + 1}`, `Поле ${i + 1}`)} aria-label={t(`Name of field ${i + 1}`, `Название поля ${i + 1}`)} maxLength={60}
                      onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <span className="mono small">{Math.round(areaHa(f.ring)).toLocaleString('en-US')} {t('ha', 'га')}</span>
                    <button className="btn btn-ghost btn-sm" disabled={busy > 0} onClick={() => calc(f.ring)}>{t('Strategies', 'Стратегии')}</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy > 0} aria-label={t(`Remove field ${i + 1}`, `Убрать поле ${i + 1}`)} onClick={() => setFields(fields.filter((_, j) => j !== i))}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="small" role="status" aria-live="polite">{busy ? t('Weather for 24 years, soil, then about 700 rotations. Keep the page open.', 'Погода за 24 года, почва, затем около 700 севооборотов. Не закрывайте страницу.') : err}</p>
            <p className="small muted">{t('Crops, prices and strategies are those of the nearest demo region: a field in Kazakhstan gets the East Kazakhstan set. Weather and soil are read at the centre of each field.',
              'Культуры, цены и стратегии берутся из ближайшего демо-региона: поле в Казахстане получает набор ВКО. Погода и почва читаются в центре каждого поля.')}</p>
          </div>
        </div>
        {fields.length >= 2 && <FarmForm fields={fields} onFarm={onFarm} />}
      </div>
    </section>
  )
}
