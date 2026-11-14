import { createContext, useContext } from 'react'
import type { Region, Strategy } from './types'

// categorical slots, fixed order (validated: dataviz palette check, contrast WARN -> direct labels + tables)
export const SC: Record<string, string> = { current: '#2a78d6', A: '#eb6834', B: '#1baf7a', C: '#eda100' }
export const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
export const worstYear = (s: Strategy) => [...s.timeline].sort((a, b) => a.profit[1] - b.profit[1])[0]

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
