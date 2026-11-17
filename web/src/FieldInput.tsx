import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { IMAGERY } from './MapView'
import { SecHead } from './SecHead'
import type { Feature } from 'geojson'
import type { Region } from './types'
import { useT } from './fmt'

type Pt = [number, number] // lon, lat

// outer ring of the first Polygon in a KML file (or its first <coordinates>), unclosed. KMZ is a zip: not read.
function kmlRing(text: string): Pt[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const poly = doc.getElementsByTagNameNS('*', 'Polygon')[0] ?? doc
  const c = poly.getElementsByTagNameNS('*', 'coordinates')[0]
  const pts = (c?.textContent ?? '').trim().split(/\s+/).map((s) => s.split(',').map(Number))
    .filter((p) => p.length >= 2 && p.every(Number.isFinite)).map(([x, y]) => [x, y] as Pt)
  const last = pts.at(-1)
  if (pts.length > 1 && last && last[0] === pts[0][0] && last[1] === pts[0][1]) pts.pop()
  return pts
}

function shape(pts: Pt[]) {
  const f: Feature[] = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))
  if (pts.length >= 3) f.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } })
  else if (pts.length === 2) f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } })
  return { type: 'FeatureCollection' as const, features: f }
}

// Outline a field (click the corners, or load KML) and send it to POST /field (pipeline/api.py).
export default function FieldInput({ onDone }: { onDone: (r: Region) => void }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [pts, setPts] = useState<Pt[]>([])
  const [busy, setBusy] = useState(0) // seconds since the request went out, 0 = idle
  const [err, setErr] = useState('')
  const latest = useRef({ pts, busy })
  useEffect(() => { latest.current = { pts, busy } }, [pts, busy])

  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current!, style: IMAGERY, center: [67, 48.5], zoom: 4, doubleClickZoom: false, attributionControl: { compact: true }, cooperativeGestures: true })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('draw', { type: 'geojson', data: shape(latest.current.pts) })
      m.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.18 } })
      m.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#ffffff', 'line-width': 2 } })
      m.addLayer({ id: 'draw-pt', type: 'circle', source: 'draw', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#232323', 'circle-stroke-width': 1.5 } })
    })
    m.on('click', (e) => { if (!latest.current.busy) setPts((p) => [...p, [+e.lngLat.lng.toFixed(5), +e.lngLat.lat.toFixed(5)]]) })
    m.getCanvas().style.cursor = 'crosshair'
    map.current = m
    const ro = new ResizeObserver(() => m.resize()) // the container can get its size after the map is made
    ro.observe(box.current!)
    return () => { ro.disconnect(); m.remove() }
  }, [])

  useEffect(() => { (map.current?.getSource('draw') as maplibregl.GeoJSONSource | undefined)?.setData(shape(pts)) }, [pts])

  const onFile = async (f?: File) => {
    if (!f) return
    const ring = kmlRing(await f.text())
    if (ring.length < 3) { setErr(t('No field outline found in this KML file', 'В этом KML-файле нет контура поля')); return }
    setErr('')
    setPts(ring)
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
    map.current?.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, duration: 0 })
  }

  const run = async () => {
    setErr('')
    setBusy(1)
    const t0 = Date.now()
    const tick = setInterval(() => setBusy(Math.max(1, Math.round((Date.now() - t0) / 1000))), 1000)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}field`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'Polygon', coordinates: [[...pts, pts[0]]] }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${res.status}`)
      onDone(d)
    } catch (e) {
      setErr(`${t('Could not calculate the field', 'Не удалось посчитать поле')}: ${(e as Error).message}`)
    } finally {
      clearInterval(tick)
      setBusy(0)
    }
  }

  return (
    <section className="sec">
      <div className="wrap">
        <SecHead title={t('Your field', 'Ваше поле')}
          sub={t('Click the corners of the field on the map, or load its outline from KML. Furrow fetches NASA POWER weather and SoilGrids soil for it and runs the strategies, in about a minute.',
            'Отметьте углы поля на карте или загрузите контур из KML. Furrow скачает для него погоду NASA POWER и почву SoilGrids и прогонит стратегии, это около минуты.')} />
        <div className="map-grid">
          <div className="map-wrap"><div ref={box} className="map" role="region" aria-label={t('Map to outline the field', 'Карта для контура поля')} /></div>
          <div className="panel field-side">
            <p className="small">{pts.length < 3
              ? t(`Corners marked: ${pts.length}. At least 3 are needed.`, `Отмечено углов: ${pts.length}. Нужно хотя бы 3.`)
              : t(`Outline of ${pts.length} corners.`, `Контур из ${pts.length} углов.`)}</p>
            <div className="btns">
              <button className="btn btn-ghost btn-sm" disabled={!pts.length || busy > 0} onClick={() => setPts((p) => p.slice(0, -1))}>{t('Undo corner', 'Убрать угол')}</button>
              <button className="btn btn-ghost btn-sm" disabled={!pts.length || busy > 0} onClick={() => setPts([])}>{t('Clear', 'Очистить')}</button>
              <label className="btn btn-ghost btn-sm">{t('Load KML', 'Загрузить KML')}
                <input type="file" accept=".kml,application/vnd.google-earth.kml+xml" className="sr-only" disabled={busy > 0}
                  onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
            <button className="btn btn-solid" disabled={pts.length < 3 || busy > 0} onClick={run}>
              {busy ? t(`Calculating, ${busy} s`, `Считаем, ${busy} с`) : t('Calculate strategies', 'Посчитать стратегии')}
            </button>
            <p className="small" role="status" aria-live="polite">{busy ? t('Weather for 24 years, soil, then about 700 rotations. Keep the page open.', 'Погода за 24 года, почва, затем около 700 севооборотов. Не закрывайте страницу.') : err}</p>
            <p className="small muted">{t('Crops, prices and strategies are those of the nearest demo region: a field in Kazakhstan gets the East Kazakhstan set. Weather and soil are read at the centre of the field.',
              'Культуры, цены и стратегии берутся из ближайшего демо-региона: поле в Казахстане получает набор ВКО. Погода и почва читаются в центре поля.')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
