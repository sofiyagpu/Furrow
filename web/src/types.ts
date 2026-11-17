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
// the reference field rerun with rain from GPM IMERG monthly totals (pipeline/build.py imerg_check())
export interface ImergCheck {
  product: string
  ratio: number // IMERG / POWER rain over the record
  years: [number, number, number][] // year, POWER mm, IMERG mm
  strategies: Record<string, { profit: Band; loss_years: number; erosion: number; irr: number }>
}

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
  id: 'az' | 'vko' | 'field'
  template?: 'az' | 'vko' // a user field (POST /field): demo region whose crops and strategies it uses
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
  imerg?: ImergCheck | null
  ml?: MlFile | null
}

// ML file from the separate carver-ml repo (data/ml/README.md). Every field may be missing.
export interface MlYear {
  crop?: string // class key, or a composition "alfalfa 26%, fallow 23%"
  source?: string // "USDA CDL" (fact) or "model" (prediction)
  bare_obs_dates?: number // satellite dates the cell was seen bare that year
  bare_months?: number[] // months (1-12) the cell was bare
  low_obs_months?: number[] // months with too few clear images to tell
  lag_months?: number[] // months the crop lagged behind the same crop nearby (NDVI): a signal, not a diagnosis
}

export interface MlCell {
  crop?: string // class key: alfalfa, corn, cotton, fallow, barley, ... or a composition "fallow 29%, corn 19%"
  crop_p?: number // 0-1, older exports; read as a pixel share
  crop_pixel_share?: number // 0-1, share of the cell's pixels in `crop`
  crop_top?: string // largest class of the cell (other left out), a single key: colours the detail map
  crop_top_share?: number // 0-1, pixel share of crop_top
  sm_rootzone?: number // m3/m3, SMAP L4 root-zone spread over the cell by NDMI: seasonal median (not a model prediction)
  sm_rootzone_pi?: [number, number] // m3/m3, 10th-90th percentile over dates
  low_confidence?: boolean
  years?: Record<string, MlYear>
}

// detail cell after pipeline/build.py: outline and the grid cell it lies in are added there
export interface MlDetailCell extends MlCell {
  b?: [number, number][] // [lon, lat] ring
  p?: string // region grid cell (H3 res 5)
}

export interface MlFile {
  model?: string
  version?: string
  validation?: string // full record, may be in Russian
  validation_en?: string // short English version; the app picks it in English
  cells?: Record<string, MlCell>
  detail?: { h3_resolution?: number; cells?: Record<string, MlDetailCell> } // finer H3 cells, optional
}
