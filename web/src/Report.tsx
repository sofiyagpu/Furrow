import type { Region } from './types'
import { SecHead } from './SecHead'
import { SC, usd, short, worstYear, cropLabel, cropShort, rname, useLang, useT } from './fmt'

// Export: a one-page printable report (browser "Save as PDF") and the same numbers as CSV.
function download(name: string, rows: (string | number)[][]) {
  const q = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  // BOM so Excel opens Cyrillic as UTF-8
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const near = (xs: number[], v: number) => xs.findIndex((x) => Math.abs(x - v) < 1e-6)

export default function Report({ r }: { r: Region }) {
  const l = useLang(), t = useT()
  const S = r.strategies
  const cell = r.cells.find((c) => c.h3 === r.rep_cell)!
  const i = near(r.twin.dT, 2), j = near(r.twin.dP, -0.1), j0 = near(r.twin.dP, 0)
  const crops = [...new Set(S.flatMap((s) => s.rotation))]
  const rot = (rotation: string[]) => rotation.map((c) => cropShort(r, c, l)).join(' → ')
  const till = (notill: boolean, irr?: string) => (notill ? 'no-till' : t('tilled', 'вспашка')) + (irr ? `, ${irr === 'drip' ? t('drip', 'капельный') : t('flood', 'напуск')}` : '')
  const today = new Date().toISOString().slice(0, 10)
  const f = (v: number) => (v > 0 ? '+' : '') + v

  const strategiesCsv = () => download(`furrow-${r.id}-strategies.csv`, [
    ['strategy', 'rotation', 'practice', 'profit_p10_usd_ha', 'profit_p50_usd_ha', 'profit_p90_usd_ha', 'loss_years_share',
      'soil_loss_t_ha_yr', 'bare_days_yr', 'soc_change_t_c_ha_yr', 'pumped_mm_yr', 'co2e_t_ha_yr', 'credit_usd_ha_yr_low', 'credit_usd_ha_yr_high',
      'worst_year', 'worst_year_profit_usd_ha', 'profit_p50_plus2c_minus10pct_rain'],
    ...S.map((s) => {
      const m = s.metrics, w = worstYear(s)
      return [s.id, rot(s.rotation), till(s.notill, s.irrigation), ...m.profit, m.loss_years,
        m.erosion, m.bare_days, m.dsoc, Math.round(m.irr[1]), s.carbon.t_co2_ha_yr, ...s.carbon.usd_ha_yr,
        w.year, w.profit[1], i >= 0 && j >= 0 ? r.twin.grid[s.id][i][j].profit[1] : '']
    }),
  ])
  const yearsCsv = () => download(`furrow-${r.id}-years.csv`, [
    ['strategy', 'harvest_year', 'profit_p10_usd_ha', 'profit_p50_usd_ha', 'profit_p90_usd_ha', 'harvests', 'pumped_mm', 'bare_days', 'wind_index'],
    ...S.flatMap((s) => s.timeline.map((x) => [s.id, x.year, ...x.profit,
      x.crops.map((c) => `${cropShort(r, c.crop, l)} ${c.yield_t}`).join('; '), Math.round(x.irr), x.bare, x.wind])),
  ])
  const cellsCsv = () => download(`furrow-${r.id}-cells.csv`, [
    ['h3', 'lat', 'lon', 'clay_pct', 'sand_pct', 'soc_g_kg', 'soc_t_c_ha_0_30cm', 'strategy', 'profit_p10', 'profit_p50', 'profit_p90', 'soil_loss_t_ha', 'soc_change_t_c_ha', 'pumped_mm'],
    ...r.cells.flatMap((c) => S.map((s) => {
      const m = c.s[s.id]
      return [c.h3, c.lat, c.lon, c.soil.clay, c.soil.sand, c.soil.soc, c.soc0, s.id, ...m.profit, m.erosion, m.dsoc, Math.round(m.irr[1])]
    })),
  ])

  return (
    <section className="sec" id="report">
      <div className="wrap">
        <div className="no-print">
          <SecHead n="8" title={t('Report and data export', 'Отчёт и выгрузка данных')} />
          <div className="export">
            <div className="panel export-main">
              <h3 className="h-sm">{t('One-page report for the agronomist', 'Отчёт на одну страницу для агронома')}</h3>
              <p className="small muted">{t('Strategies, worst year, +2 °C scenario, carbon and prices. Opens the print dialog: choose Save as PDF.', 'Стратегии, худший год, сценарий +2 °C, углерод и цены. Откроется печать: выберите «Сохранить как PDF».')}</p>
              <button className="btn btn-solid" onClick={() => print()}>{t('Save the report as PDF', 'Сохранить отчёт в PDF')}</button>
            </div>
            <div className="panel">
              <h3 className="h-sm">{t('Tables for a spreadsheet', 'Таблицы для Excel')}</h3>
              <div className="export-list">
                <button className="btn btn-ghost" onClick={strategiesCsv}>{t('Strategies, CSV', 'Стратегии, CSV')}</button>
                <button className="btn btn-ghost" onClick={yearsCsv}>{t(`Every year ${r.years[0]}–${r.years[1]}, CSV`, `Все годы ${r.years[0]}–${r.years[1]}, CSV`)}</button>
                <button className="btn btn-ghost" onClick={cellsCsv}>{t(`All ${r.cells.length} map cells, CSV`, `Все ${r.cells.length} ячеек карты, CSV`)}</button>
              </div>
            </div>
          </div>
        </div>

        <article className="doc print-only">
          <header className="doc-head">
            <p className="label">Furrow · {t('rotation comparison', 'сравнение севооборотов')} · {today}</p>
            <h3 className="h-md">{rname(r, l)}</h3>
            <p className="small mono">
              {t('Reference field', 'Опорное поле')} H3 {r.rep_cell} · {cell.lat.toFixed(3)}, {cell.lon.toFixed(3)} · {t('clay', 'глина')} {cell.soil.clay.toFixed(0)}%, {t('sand', 'песок')} {cell.soil.sand.toFixed(0)}%,
              SOC {cell.soil.soc.toFixed(1)} {t('g/kg', 'г/кг')} · NASA POWER {r.years[0]}–{r.years[1]} · {r.irrigated ? t('irrigated', 'орошение') : t('rain-fed', 'богара')}
            </p>
          </header>

          <h4>1. {t('Strategies, per hectare a year', 'Стратегии, на гектар в год')}</h4>
          <table className="tbl">
            <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Rotation', 'Севооборот')}</th><th>{t('Profit P10 · P50 · P90', 'Прибыль P10 · P50 · P90')}</th><th>{t('Loss years', 'Убыт. лет')}</th><th>{t('Soil loss, t', 'Эрозия, т')}</th><th>{t('Bare days', 'Голых дней')}</th><th>{t('Soil C, t', 'Углерод, т')}</th>{r.irrigated && <th>{t('Pumped, mm', 'Откачка, мм')}</th>}</tr></thead>
            <tbody>
              {S.map((s) => (
                <tr key={s.id}>
                  <td><span className="dot" style={{ background: SC[s.id] }} />{short(s, l)}</td>
                  <td>{rot(s.rotation)}, {till(s.notill, s.irrigation)}</td>
                  <td className="mono">{usd(s.metrics.profit[0])} · {usd(s.metrics.profit[1])} · {usd(s.metrics.profit[2])}</td>
                  <td className="mono">{Math.round(s.metrics.loss_years * 100)}%</td>
                  <td className="mono">{s.metrics.erosion}</td>
                  <td className="mono">{s.metrics.bare_days}</td>
                  <td className="mono">{f(s.metrics.dsoc)}</td>
                  {r.irrigated && <td className="mono">{Math.round(s.metrics.irr[1])}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="doc-two">
            <div>
              <h4>2. {t('Worst weather year', 'Худший по погоде год')}</h4>
              <table className="tbl">
                <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Year', 'Год')}</th><th>{t('Median profit', 'Медиана прибыли')}</th></tr></thead>
                <tbody>
                  {S.map((s) => { const w = worstYear(s); return (
                    <tr key={s.id}><td>{short(s, l)}</td><td className="mono">{w.year}</td><td className="mono">{usd(w.profit[1])}</td></tr>
                  ) })}
                </tbody>
              </table>
            </div>
            {i >= 0 && j >= 0 && (
              <div>
                <h4>3. {t('Scenario: +2 °C, 10% less rain', 'Сценарий: +2 °C, осадков на 10% меньше')}</h4>
                <table className="tbl">
                  <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('Median profit', 'Медиана прибыли')}</th><th>{t('vs today', 'к сегодня')}</th></tr></thead>
                  <tbody>
                    {S.map((s) => { const g = r.twin.grid[s.id][i][j].profit[1], b = r.twin.grid[s.id][0][j0].profit[1]; return (
                      <tr key={s.id}><td>{short(s, l)}</td><td className="mono">{usd(g)}</td><td className="mono">{usd(g - b)}</td></tr>
                    ) })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <h4>4. {r.irrigated ? t('Soil carbon and groundwater vs current practice', 'Углерод и подземные воды к текущей практике') : t('Soil carbon vs current practice', 'Почвенный углерод к текущей практике')}</h4>
          <table className="tbl">
            <thead><tr><th>{t('Strategy', 'Стратегия')}</th><th>{t('t CO2e/ha a year', 'т CO2e/га в год')}</th><th>{t('Credit, $/ha a year', 'Кредит, $/га в год')}</th>{r.irrigated && <th>{t('Water saved, m³/ha', 'Сэкономлено воды, м³/га')}</th>}</tr></thead>
            <tbody>
              {S.slice(1).map((s) => (
                <tr key={s.id}>
                  <td>{short(s, l)}</td><td className="mono">{s.carbon.t_co2_ha_yr}</td>
                  <td className="mono">{usd(s.carbon.usd_ha_yr[0])}…{usd(s.carbon.usd_ha_yr[1])}</td>
                  {r.irrigated && <td className="mono">{Math.round(s.water_saved_mm * 10).toLocaleString('en-US')}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <h4>5. {t('Prices and costs', 'Цены и затраты')}</h4>
          <table className="tbl">
            <thead><tr><th>{t('Crop', 'Культура')}</th><th>{t('Price, $/t', 'Цена, $/т')}</th><th>{t('Cost, $/ha', 'Затраты, $/га')}</th><th>{t('Attainable yield, t/ha', 'Достижимый урожай, т/га')}</th></tr></thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c}><td>{cropLabel(r, c, l)}</td><td className="mono">{r.crops[c].price}</td><td className="mono">{r.crops[c].cost}</td><td className="mono">{r.crops[c].ymax}</td></tr>
              ))}
            </tbody>
          </table>

          <p className="small doc-foot">
            NASA POWER, ISRIC SoilGrids 2.0, NASA GIBS (MODIS, SMAP, GPM IMERG, GRACE-FO). FAO-56, FAO-33, RWEQ/RUSLE, RothC-26.3, NSGA-II.
          </p>
        </article>
      </div>
    </section>
  )
}
