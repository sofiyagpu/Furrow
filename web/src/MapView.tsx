import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Region } from './types'
import { useT, useLang, usd, mlCells, mlHas, mlDetail, mlCrop, ML_COLOURS, ML_OTHER_COLOUR } from './fmt'

maplibregl.setWorkerUrl(workerUrl) // bundlers lose maplibre's own relative worker path

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
export const NASA_LAYERS = {
  none: { label: 'Imagery only', ru: 'Только снимок' },
  ndvi: { label: 'MODIS NDVI, 16-day', ru: 'MODIS NDVI, 16 дней', id: 'MODIS_Terra_L3_NDVI_16Day', tms: 'GoogleMapsCompatible_Level9', max: 9 },
  smap: { label: 'SMAP root-zone moisture', ru: 'SMAP, влага корневой зоны', id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', tms: 'GoogleMapsCompatible_Level6', max: 6 },
  imerg: { label: 'GPM IMERG rain rate', ru: 'GPM IMERG, осадки', id: 'IMERG_Precipitation_Rate', tms: 'GoogleMapsCompatible_Level6', max: 6 },
  grace: { label: 'GRACE-FO water storage', ru: 'GRACE-FO, запасы воды', id: 'GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI', tms: 'GoogleMapsCompatible_Level6', max: 6 },
} as const
export type NasaLayer = keyof typeof NASA_LAYERS

export type MetricKey = 'profit' | 'erosion' | 'dsoc' | 'irr'

// value for colouring, higher = better for the farmer/soil
export function cellValue(r: Region, h3: string, sid: string, m: MetricKey) {
  const s = r.cells.find((c) => c.h3 === h3)!.s[sid]
  if (m === 'profit') return s.profit[1]
  if (m === 'erosion') return -s.erosion
  if (m === 'dsoc') return s.dsoc
  return -s.irr[1]
}

// field-score bands, worse -> better within the region
const RAMP = ['#c7402c', '#e0803a', '#e8c24c', '#a6c957', '#57a552']
const RGB = RAMP.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))

// detail: an ML detail cell (finer H3) inside `selected`, or null; clicking one selects its grid cell and the detail cell
type P = {
  region: Region; strategy: string; metric: MetricKey; layer: NasaLayer; selected: string; onSelect: (h3: string) => void
  detail?: string | null; onSelectDetail?: (h3: string | null) => void
}

export default function MapView(props: P) {
  const t = useT(), l = useLang(), ru = l === 'ru'
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pins = useRef<maplibregl.Marker[]>([])
  const latest = useRef(props)
  latest.current = props
  const detailCells = mlDetail(props.region)
  const [showDetail, setShowDetail] = useState(true)
  const showRef = useRef(showDetail) // read by the map's load handler
  useEffect(() => { showRef.current = showDetail }, [showDetail])
  const detailOn = showDetail && detailCells.length > 0
  const detailCrops = [...new Set(detailCells.map(([, c]) => c.crop_top).filter((k): k is string => !!k))]
    .sort((a, b) => detailCells.filter(([, c]) => c.crop_top === b).length - detailCells.filter(([, c]) => c.crop_top === a).length)

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          img: {
            type: 'raster', tileSize: 256, maxzoom: 17,
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            attribution: 'Imagery Esri, Maxar · NASA GIBS',
          },
        },
        layers: [{ id: 'img', type: 'raster', source: 'img', paint: { 'raster-saturation': -0.2 } }],
      },
      bounds: flip(props.region.bbox),
      fitBoundsOptions: { padding: 40 },
      cooperativeGestures: true,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      const p = latest.current
      m.addSource('field', { type: 'image', ...raster(p) })
      m.addLayer({ id: 'field', type: 'raster', source: 'field', paint: { 'raster-opacity': fieldOpacity(p.layer), 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } })
      m.addSource('cells', { type: 'geojson', data: geo(p.region) })
      m.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': '#000', 'fill-opacity': 0 } }) // hit area
      m.addLayer({ id: 'edge', type: 'line', source: 'cells', paint: { 'line-color': '#ffffff', 'line-opacity': 0.85, 'line-width': 1.5 } })
      m.addLayer({ id: 'sel', type: 'line', source: 'cells', filter: ['==', ['get', 'h3'], p.selected], paint: { 'line-color': '#ffffff', 'line-width': 4 } })
      m.addLayer({ id: 'ml', type: 'line', source: 'cells', filter: ['==', ['get', 'ml'], true], paint: { 'line-color': '#00e5ff', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } })
      if (mlDetail(p.region).length) {
        m.addSource('mld', { type: 'geojson', data: detailGeo(p.region) })
        const vis = showRef.current ? 'visible' : 'none'
        m.addLayer({ id: 'mld', type: 'fill', source: 'mld', layout: { visibility: vis }, paint: { 'fill-color': ['coalesce', ['get', 'colour'], ML_OTHER_COLOUR], 'fill-opacity': 0.78 } })
        m.addLayer({ id: 'mld-edge', type: 'line', source: 'mld', layout: { visibility: vis }, paint: { 'line-color': '#1b1b1b', 'line-opacity': 0.35, 'line-width': 0.5 } })
        m.addLayer({ id: 'mld-sel', type: 'line', source: 'mld', layout: { visibility: vis }, filter: ['==', ['get', 'h3'], p.detail ?? ''], paint: { 'line-color': '#00e5ff', 'line-width': 3 } })
      }
      // one click handler: a visible detail cell under the pointer wins, else the grid cell
      m.on('click', 'cells', (e: maplibregl.MapLayerMouseEvent) => {
        const cur = latest.current
        const fine = m.getLayer('mld') && m.getLayoutProperty('mld', 'visibility') !== 'none' ? m.queryRenderedFeatures(e.point, { layers: ['mld'] })[0] : undefined
        if (fine && cur.region.cells.some((c) => c.h3 === fine.properties!.p)) {
          cur.onSelect(fine.properties!.p)
          cur.onSelectDetail?.(fine.properties!.h3)
        } else if (e.features?.[0]) {
          cur.onSelect(e.features[0].properties!.h3)
          cur.onSelectDetail?.(null)
        }
      })
      m.on('mouseenter', 'cells', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'cells', () => (m.getCanvas().style.cursor = ''))
      setNasa(m, p.layer)
      drawPins(m, p, pins.current, ru)
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize()) // the side panel can open and close
    ro.observe(box.current!)
    return () => { ro.disconnect(); pins.current.forEach((x) => x.remove()); pins.current = []; m.remove() }
  }, [props.region.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m?.isStyleLoaded() || !m.getSource('field')) return
    ;(m.getSource('field') as maplibregl.ImageSource).updateImage(raster(props))
    m.setFilter('sel', ['==', ['get', 'h3'], props.selected])
    drawPins(m, props, pins.current, ru)
  }, [props.strategy, props.metric, props.selected, ru]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m?.isStyleLoaded()) return
    setNasa(m, props.layer)
    m.setPaintProperty('field', 'raster-opacity', fieldOpacity(props.layer))
  }, [props.layer])

  useEffect(() => {
    const m = map.current
    if (!m?.getLayer('mld')) return // layers exist once loaded; isStyleLoaded() is false while the field image updates
    for (const id of ['mld', 'mld-edge', 'mld-sel']) m.setLayoutProperty(id, 'visibility', showDetail ? 'visible' : 'none')
    m.setFilter('mld-sel', ['==', ['get', 'h3'], props.detail ?? ''])
  }, [showDetail, props.detail])

  const zoomToDetail = () => {
    const pts = detailCells.flatMap(([, c]) => c.b!)
    if (!map.current || !pts.length) return
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
    map.current.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 40, duration: 800 })
  }

  return (
    <div className="map-wrap">
      <div ref={box} className="map" role="region" aria-label={`Map of ${props.region.name}`} />
      <div className="map-legend">
        <div className="map-legend-bar">{RAMP.map((c) => <i key={c} style={{ background: c }} />)}</div>
        <div className="row-between small"><span>{t('worse', 'хуже')}</span><span>{t('better', 'лучше')}</span></div>
        <p className="map-legend-note">{t('Within this region, smoothed between cell centres', 'Внутри региона, сглажено между центрами ячеек')}</p>
        {(mlCells(props.region).length > 0 || detailCells.length > 0) && <p className="map-legend-ml small"><i />{t('cell has ML data', 'есть ML-данные')}</p>}
        {detailCells.length > 0 && (
          <div className="map-legend-detail">
            <label className="small"><input type="checkbox" checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} />
              {props.region.id === 'vko' ? t('Satellite: where cropland lay bare all summer', 'Спутник: где пашня стояла голой всё лето') : t('Satellite field view: what grew', 'Спутник: что росло на полях')}</label>
            {detailOn && (
              <>
                <ul className="map-legend-crops">
                  {detailCrops.map((k) => <li key={k}><i style={{ background: ML_COLOURS[k] ?? ML_OTHER_COLOUR }} />{mlCrop(k, l)}</li>)}
                </ul>
                <button type="button" className="btn btn-ghost btn-sm" onClick={zoomToDetail}>{t('Zoom to the fields', 'Приблизить к полям')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const fieldOpacity = (layer: NasaLayer) => (layer === 'none' ? 0.62 : 0.35) // imagery shows through

function setNasa(m: maplibregl.Map, layer: NasaLayer) {
  if (m.getLayer('nasa')) m.removeLayer('nasa')
  if (m.getSource('nasa')) m.removeSource('nasa')
  const l = NASA_LAYERS[layer]
  if (!('id' in l)) return
  m.addSource('nasa', { type: 'raster', tileSize: 256, maxzoom: l.max, tiles: [`${GIBS}/${l.id}/default/default/${l.tms}/{z}/{y}/{x}.png`] })
  m.addLayer({ id: 'nasa', type: 'raster', source: 'nasa', paint: { 'raster-opacity': 0.8 } }, 'field')
}

function flip(b: Region['bbox']): [[number, number], [number, number]] {
  return [[b[0][1], b[0][0]], [b[1][1], b[1][0]]]
}

const centre = (b: [number, number][]) => [b.reduce((s, p) => s + p[0], 0) / b.length, b.reduce((s, p) => s + p[1], 0) / b.length]

function geo(r: Region) {
  const withDetail = new Set(mlDetail(r).map(([, c]) => c.p))
  return {
    type: 'FeatureCollection' as const,
    features: r.cells.map((c) => ({
      type: 'Feature' as const,
      properties: { h3: c.h3, ml: mlHas(r.ml?.cells?.[c.h3]) || withDetail.has(c.h3) },
      geometry: { type: 'Polygon' as const, coordinates: [[...c.b, c.b[0]]] },
    })),
  }
}

// ML detail cells (finer H3), coloured by their largest class
function detailGeo(r: Region) {
  return {
    type: 'FeatureCollection' as const,
    features: mlDetail(r).map(([h, c]) => ({
      type: 'Feature' as const,
      properties: { h3: h, p: c.p!, colour: (c.crop_top && ML_COLOURS[c.crop_top]) || ML_OTHER_COLOUR },
      geometry: { type: 'Polygon' as const, coordinates: [[...c.b!, c.b![0]]] },
    })),
  }
}

function inside(x: number, y: number, poly: [number, number][]) {
  let ok = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok
  }
  return ok
}

// Banded surface over the cells: inverse-distance blend of cell-centre values, clipped to the cells.
// ponytail: CPU canvas, ~0.2 MP; move to a WebGL layer if the region grows to hundreds of cells.
function raster(p: { region: Region; strategy: string; metric: MetricKey }) {
  const cells = p.region.cells
  const vals = cells.map((c) => cellValue(p.region, c.h3, p.strategy, p.metric))
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const ctr = cells.map((c) => centre(c.b))
  const all = cells.flatMap((c) => c.b)
  const x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0]))
  const y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]))
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  const unmerc = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI
  const W = 520, top = merc(y1), bot = merc(y0)
  const H = Math.round((W * (top - bot)) / (((x1 - x0) * Math.PI) / 180))
  const kx = Math.cos(((y0 + y1) / 2) * (Math.PI / 180))
  const box = cells.map((c) => [Math.min(...c.b.map((q) => q[0])), Math.max(...c.b.map((q) => q[0])), Math.min(...c.b.map((q) => q[1])), Math.max(...c.b.map((q) => q[1]))])
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let py = 0; py < H; py++) {
    const lat = unmerc(top - ((py + 0.5) / H) * (top - bot))
    for (let px = 0; px < W; px++) {
      const lon = x0 + ((px + 0.5) / W) * (x1 - x0)
      let hit = false
      for (let k = 0; k < cells.length && !hit; k++) {
        const b = box[k]
        hit = lon >= b[0] && lon <= b[1] && lat >= b[2] && lat <= b[3] && inside(lon, lat, cells[k].b)
      }
      if (!hit) continue
      let sw = 0, sv = 0
      for (let k = 0; k < cells.length; k++) {
        const dx = (lon - ctr[k][0]) * kx, dy = lat - ctr[k][1]
        const w = 1 / (dx * dx + dy * dy + 1e-9) ** 1.5
        sw += w; sv += w * vals[k]
      }
      const tt = hi > lo ? (sv / sw - lo) / (hi - lo) : 0.5
      const [r, g, b] = RGB[Math.min(RGB.length - 1, Math.floor(tt * RGB.length))]
      const o = (py * W + px) * 4
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return {
    url: cv.toDataURL(),
    coordinates: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]] as [[number, number], [number, number], [number, number], [number, number]],
  }
}

// a pin per cell: hollow ring at the model point, a pill with the cell's value
function drawPins(m: maplibregl.Map, p: P, pins: maplibregl.Marker[], ru: boolean) {
  pins.forEach((x) => x.remove())
  pins.length = 0
  const vals = p.region.cells.map((c) => cellValue(p.region, c.h3, p.strategy, p.metric))
  const lo = Math.min(...vals), hi = Math.max(...vals)
  p.region.cells.forEach((c, i) => {
    const s = c.s[p.strategy]
    const txt = p.metric === 'profit' ? usd(s.profit[1]) : p.metric === 'erosion' ? `${s.erosion} ${ru ? 'т' : 't'}` : p.metric === 'dsoc' ? `${s.dsoc > 0 ? '+' : ''}${s.dsoc}` : `${Math.round(s.irr[1])} ${ru ? 'мм' : 'mm'}`
    const band = RAMP[Math.min(RAMP.length - 1, Math.floor((hi > lo ? (vals[i] - lo) / (hi - lo) : 0.5) * RAMP.length))]
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `pin${c.h3 === p.selected ? ' on' : ''}`
    el.setAttribute('aria-label', `${txt}`)
    const what = { profit: ru ? 'Прибыль, медиана' : 'Median profit', erosion: ru ? 'Эрозия в год' : 'Soil loss a year', dsoc: ru ? 'Углерод, т/га в год' : 'Soil carbon, t/ha a year', irr: ru ? 'Откачка в год' : 'Pumped a year' }[p.metric]
    el.style.setProperty('--c', band)
    el.innerHTML = `<i class="ring"></i><span class="pill"><em>${what}</em><strong>${txt}</strong></span>`
    el.onclick = (e) => { e.stopPropagation(); p.onSelect(c.h3) }
    pins.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(centre(c.b) as [number, number]).addTo(m))
  })
}
