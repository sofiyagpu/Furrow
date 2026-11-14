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
  rotation: string[]
  notill: boolean
  irrigation?: string
  idea: string
  risk: string
  metrics: Metrics
  timeline: YearRow[]
  dekads: [string, number, number, string][] // date, soil water mm, cover 0-1, crop
  carbon: { t_co2_ha_yr: number; usd_ha_yr: [number, number] }
  water_saved_mm: number
}

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
  bbox: [[number, number], [number, number]]
  irrigated: boolean
  years: [number, number]
  rep_cell: string
  climate: { month: number; rain: number; tmean: number; et0: number; wind: number }[]
  crops: Record<string, { label: string; price: number; cost: number; ymax: number; family: string }>
  assumptions: { co2_price: [number, number]; buffer: number; pump_cost_m3: number; irrigation_eff: Record<string, number> }
  cells: Cell[]
  strategies: Strategy[]
  twin: { dT: number[]; dP: number[]; grid: Record<string, TwinCell[][]> }
  pareto: ParetoPoint[]
  cloud: ParetoPoint[]
  ml: null | { model: string; version: string; validation: string; cells: Record<string, { crop?: string; crop_p?: number; sm_rootzone?: number }> }
}
