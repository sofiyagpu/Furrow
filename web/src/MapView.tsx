import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Region } from './types'

maplibregl.setWorkerUrl(workerUrl) // bundlers lose maplibre's own relative worker path

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
export const NASA_LAYERS = {
  none: { label: 'Imagery only' },
  ndvi: { label: 'MODIS NDVI, 16-day', id: 'MODIS_Terra_L3_NDVI_16Day', tms: 'GoogleMapsCompatible_Level9', max: 9 },
  smap: { label: 'SMAP root-zone moisture', id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', tms: 'GoogleMapsCompatible_Level6', max: 6 },
  imerg: { label: 'GPM IMERG rain rate', id: 'IMERG_Precipitation_Rate', tms: 'GoogleMapsCompatible_Level6', max: 6 },
  grace: { label: 'GRACE-FO water storage', id: 'GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI', tms: 'GoogleMapsCompatible_Level6', max: 6 },
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

export default function MapView(props: {
  region: Region
  strategy: string
  metric: MetricKey
  layer: NasaLayer
  selected: string
  onSelect: (h3: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const latest = useRef(props)
  latest.current = props

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
        layers: [{ id: 'img', type: 'raster', source: 'img', paint: { 'raster-saturation': -0.25 } }],
      },
      bounds: flip(props.region.bbox),
      fitBoundsOptions: { padding: 40 },
      cooperativeGestures: true,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('cells', { type: 'geojson', data: geo(latest.current) })
      m.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.55 } })
      m.addLayer({ id: 'edge', type: 'line', source: 'cells', paint: { 'line-color': '#ffffff', 'line-opacity': 0.6, 'line-width': 1 } })
      m.addLayer({
        id: 'sel', type: 'line', source: 'cells', filter: ['==', ['get', 'h3'], latest.current.selected],
        paint: { 'line-color': '#a1ffcb', 'line-width': 3.5 },
      })
      m.on('click', 'cells', (e: maplibregl.MapLayerMouseEvent) => e.features?.[0] && latest.current.onSelect(e.features[0].properties!.h3))
      m.on('mouseenter', 'cells', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'cells', () => (m.getCanvas().style.cursor = ''))
      setNasa(m, latest.current.layer)
    })
    map.current = m
    ;(window as unknown as { __map: maplibregl.Map }).__map = m // debug handle
    return () => m.remove()
  }, [props.region.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m?.isStyleLoaded() || !m.getSource('cells')) return
    ;(m.getSource('cells') as maplibregl.GeoJSONSource).setData(geo(props))
    m.setFilter('sel', ['==', ['get', 'h3'], props.selected])
  }, [props.strategy, props.metric, props.selected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (m?.isStyleLoaded()) setNasa(m, props.layer)
  }, [props.layer])

  return <div ref={box} className="map" data-lenis-prevent role="region" aria-label={`Map of ${props.region.name}`} />
}

function setNasa(m: maplibregl.Map, layer: NasaLayer) {
  if (m.getLayer('nasa')) m.removeLayer('nasa')
  if (m.getSource('nasa')) m.removeSource('nasa')
  const l = NASA_LAYERS[layer]
  if (!('id' in l)) return
  m.addSource('nasa', {
    type: 'raster', tileSize: 256, maxzoom: l.max,
    tiles: [`${GIBS}/${l.id}/default/default/${l.tms}/{z}/{y}/{x}.png`],
  })
  m.addLayer({ id: 'nasa', type: 'raster', source: 'nasa', paint: { 'raster-opacity': 0.75 } }, 'cells')
}

function flip(b: Region['bbox']): [[number, number], [number, number]] {
  return [[b[0][1], b[0][0]], [b[1][1], b[1][0]]]
}

// diverging-free sequential ramp: low = warm clay, high = mint green
const RAMP = ['#b4532a', '#d98a4e', '#ecc58a', '#d9e8b0', '#8fd6a7', '#2f9e6b']
function geo(p: { region: Region; strategy: string; metric: MetricKey }) {
  const vals = p.region.cells.map((c) => cellValue(p.region, c.h3, p.strategy, p.metric))
  const lo = Math.min(...vals), hi = Math.max(...vals)
  return {
    type: 'FeatureCollection' as const,
    features: p.region.cells.map((c, i) => {
      const t = hi > lo ? (vals[i] - lo) / (hi - lo) : 0.5
      return {
        type: 'Feature' as const,
        properties: { h3: c.h3, c: RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))] },
        geometry: { type: 'Polygon' as const, coordinates: [[...c.b, c.b[0]]] },
      }
    }),
  }
}
