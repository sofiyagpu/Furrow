export type Band = [number, number, number] // P10, P50, P90

export interface Metrics {
  profit: Band
  profit_mean: number
  loss_years: number
  wind: Band
  water: Band
  erosion: number
  irr: Band
  bare_days: number
  dsoc: number
}

export interface YearRow {
  year: number
  profit: Band
  crops: { crop: string; yield_t: number; profit: number; irr: number; eta: number; etc: number }[]
  wind: number
  irr: number
  soc: number
  bare: number
}

export interface Strategy {
  id: string
  name: string
  name_ru?: string
  rotation: string[]
  notill: boolean
  irrigation?: string
  idea: string
  idea_ru?: string
  risk: string
  risk_ru?: string
  why?: string // why this rotation for this region
  why_ru?: string
  metrics: Metrics
  timeline: YearRow[]
  dekads: [string, number, number, string][] // date, soil water mm, cover 0-1, crop
  carbon: { t_co2_ha_yr: number; usd_ha_yr: [number, number] }
  water_saved_mm: number
  farm?: Farm
}

// priority numbers per strategy, $/ha and kg/ha a year (pipeline/build.py farm())
export interface Farm {
  revenue: number // mean revenue, scales with the price slider
  n_kg: number // mineral N bought, after legume credit
  deep_market: number | null // share of revenue from crops with a deep market, 0-1
  water_stress: number | null // mean 1 - ETa/ETc over harvested crops, 0-1
}

// model soil water against SMAP L4 root zone at the reference field (pipeline/build.py smap_check())
export interface SmapCheck { layer: string; n: number; r: number; r_anom: number; series: [string, number, number][] } // date, m3/m3, mm

export interface Cell {
  h3: string
  lat: number
  lon: number
  b: [number, number][]
  soil: { clay: number; sand: number; soc: number; bdod: number }
  soc0: number
  s: Record<string, Pick<Metrics, 'profit' | 'erosion' | 'dsoc' | 'irr' | 'bare_days' | 'loss_years'>>
}

export interface TwinCell { profit: Band; erosion: number; irr: number; loss_years: number }

export interface ParetoPoint { rotation: string[]; notill: boolean; irrigation?: string; metrics: Metrics }

export interface Region {
  id: 'az' | 'vko'
  name: string
  name_ru?: string
  bbox: [[number, number], [number, number]]
  irrigated: boolean
  years: [number, number]
  rep_cell: string
  climate: { month: number; rain: number; tmean: number; et0: number; wind: number }[]
  crops: Record<string, { label: string; label_ru?: string; price: number; cost: number; ymax: number; family: string; n?: number; market?: 'deep' | 'thin' | null }>
  assumptions: { co2_price: [number, number]; buffer: number; pump_cost_m3: number; irrigation_eff: Record<string, number>; n_credit?: number }
  cells: Cell[]
  strategies: Strategy[]
  twin: { dT: number[]; dP: number[]; grid: Record<string, TwinCell[][]> }
  pareto: ParetoPoint[]
  cloud: ParetoPoint[]
  smap?: SmapCheck | null
  ml?: MlFile | null
}

// ML file from the separate carver-ml repo (data/ml/README.md). Every field may be missing.
export interface MlYear {
  crop?: string
  bare_obs_dates?: number // satellite dates the cell was seen bare that year
}

export interface MlCell {
  crop?: string // class key: alfalfa, corn, cotton, fallow, barley, ...
  crop_p?: number // 0-1, older exports; read as a pixel share
  crop_pixel_share?: number // 0-1, share of the cell's pixels in `crop`
  low_confidence?: boolean
  years?: Record<string, MlYear>
}

export interface MlFile {
  model?: string
  version?: string
  validation?: string
  cells?: Record<string, MlCell>
}
