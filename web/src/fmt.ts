import { createContext, useContext, useState } from 'react'
import type { MlCell, Region, Strategy } from './types'

// categorical slots, fixed order (validated: dataviz palette check, contrast WARN -> direct labels + tables)
export const SC: Record<string, string> = { current: '#2a78d6', A: '#eb6834', B: '#1baf7a', C: '#eda100' }
export const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
export const worstYear = (s: Strategy) => [...s.timeline].sort((a, b) => a.profit[1] - b.profit[1])[0]

// CSV download; BOM so Excel opens Cyrillic as UTF-8
export function download(name: string, rows: (string | number)[][]) {
  const q = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// POST to the API (pipeline/api.py) with a seconds counter: busy = seconds since the request went out, 0 = idle
export function usePost() {
  const [busy, setBusy] = useState(0)
  const [err, setErr] = useState('')
  const run = async <T,>(path: string, body: unknown, onOk: (d: T) => void, fail: string) => {
    setErr('')
    setBusy(1)
    const t0 = Date.now()
    const tick = setInterval(() => setBusy(Math.max(1, Math.round((Date.now() - t0) / 1000))), 1000)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof d?.detail === 'string' ? d.detail : `HTTP ${res.status}`)
      onOk(d)
    } catch (e) {
      setErr(`${fail}: ${(e as Error).message}`)
    } finally {
      clearInterval(tick)
      setBusy(0)
    }
  }
  return { busy, err, setErr, run }
}

export type Pt = [number, number] // lon, lat
export type DrawnField = { name: string; ring: Pt[] }

// field area, ha: same local projection as pipeline/plan.py area_ha
export function areaHa(ring: Pt[]) {
  const k = Math.cos((ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180)) * 111320
  let a = 0
  ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; a += (p[0] * q[1] - q[0] * p[1]) * k * 110540 })
  return Math.abs(a) / 2 / 1e4
}

export type Lang = 'en' | 'ru'
export const LangCtx = createContext<Lang>('en')
export const useLang = () => useContext(LangCtx)
// t('English', 'Русский'): strings stay next to where they are used
export const useT = () => { const l = useLang(); return (en: string, ru: string) => (l === 'ru' ? ru : en) }

export const short = (s: Strategy, l: Lang) => (s.id === 'current' ? (l === 'ru' ? 'Сейчас' : 'Current') : `${l === 'ru' ? 'Стратегия' : 'Strategy'} ${s.id}`)
export const sname = (s: Strategy, l: Lang) => (l === 'ru' && s.name_ru) || s.name
export const cropLabel = (r: Region, c: string, l: Lang) => ((l === 'ru' && r.crops[c].label_ru) || r.crops[c].label)
export const cropShort = (r: Region, c: string, l: Lang) => cropLabel(r, c, l).split(' (')[0]
export const rname = (r: Region, l: Lang) => (l === 'ru' && r.name_ru) || r.name

// Display names for crop keys coming from the ML repo. Labels only: model and strategy crops are separate.
const ML_CROPS: Record<string, [string, string]> = {
  alfalfa: ['Alfalfa', 'Люцерна'],
  barley: ['Barley', 'Ячмень'],
  chickpea: ['Chickpea', 'Нут'],
  corn: ['Corn', 'Кукуруза'],
  cotton: ['Cotton', 'Хлопчатник'],
  cover: ['Cowpea cover', 'Вигна, покровная'],
  durum: ['Durum wheat', 'Твёрдая пшеница'],
  fallow: ['Fallow', 'Пар'],
  flax: ['Oilseed flax', 'Лён масличный'],
  guar: ['Guar', 'Гуар'],
  lentil: ['Lentil', 'Чечевица'],
  millet: ['Proso millet', 'Просо'],
  pea: ['Field pea', 'Горох'],
  rapeseed: ['Spring rapeseed', 'Яровой рапс'],
  sainfoin: ['Sainfoin', 'Эспарцет'],
  sorghum: ['Grain sorghum', 'Зерновое сорго'],
  wheat: ['Wheat', 'Пшеница'],
  small_grains: ['Small grains', 'Зерновые'],
  cropped: ['Green cropland', 'Пашня под культурой'], // vko: cropland green in peak season, crop unknown
  fallow_part: ['Partly fallow (20–50%)', 'Частично пар (20–50%)'], // vko hotspot: black fallow 20-50% of cell cropland
}
export const mlCrop = (key: string, l: Lang) => ML_CROPS[key]?.[l === 'ru' ? 1 : 0] ?? key
// a composition "fallow 29%, corn 19% (низкая достоверность)": translate the class keys and the low-confidence mark
export const mlText = (text: string, l: Lang) =>
  text.replace(/\b[a-z_]+\b/g, (k) => (k in ML_CROPS ? mlCrop(k, l) : k)).replace(/\(низкая достоверность\)/g, l === 'ru' ? '(низкая достоверность)' : '(low confidence)')
// validation in the page language: validation_en in English when present, else the file's validation as written
export const mlValidation = (r: Region, l: Lang) => (l === 'en' ? r.ml?.validation_en ?? r.ml?.validation : r.ml?.validation)

// detail map colours by crop_top; other keys fall back to grey
export const ML_COLOURS: Record<string, string> = { alfalfa: '#8e6cf0', corn: '#f5b301', cotton: '#f2f2f2', fallow: '#9c5a2e', small_grains: '#ef7fa8', barley: '#ef7fa8', wheat: '#e3d26f', cropped: '#3fbf8f', fallow_part: '#d9a066' }
export const ML_OTHER_COLOUR = '#8a8a8a'

const MONTHS: [string, string][] = [['Jan', 'янв'], ['Feb', 'фев'], ['Mar', 'мар'], ['Apr', 'апр'], ['May', 'май'], ['Jun', 'июн'], ['Jul', 'июл'], ['Aug', 'авг'], ['Sep', 'сен'], ['Oct', 'окт'], ['Nov', 'ноя'], ['Dec', 'дек']]
export const months = (ms: number[], l: Lang) => ms.filter((m) => m >= 1 && m <= 12).map((m) => MONTHS[m - 1][l === 'ru' ? 1 : 0]).join(', ')

// detail cells that can be drawn (outline from build.py, grid cell in this region)
export const mlDetail = (r: Region) => {
  const grid = new Set(r.cells.map((c) => c.h3))
  return Object.entries(r.ml?.detail?.cells ?? {}).filter(([, c]) => c.b && c.b.length >= 3 && c.p && grid.has(c.p))
}

// a cell counts as having ML data only if it carries something to show
export const mlHas = (c?: MlCell) => !!c && (!!c.crop || !!c.crop_top || !!c.low_confidence || Object.keys(c.years ?? {}).length > 0)

// region cells with ML data; [] when the file or `cells` is missing or empty
export const mlCells = (r: Region) => r.cells.filter((c) => mlHas(r.ml?.cells?.[c.h3])).map((c) => c.h3)
