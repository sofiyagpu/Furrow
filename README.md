# Furrow: crop rotation planner on NASA data

NASA Space Apps 2026, challenge *Adapting farms with NASA data*. Two demo regions: Pinal County, Arizona
(irrigated, aquifer under stress) and East Kazakhstan (rain-fed steppe, wheat-wheat-black fallow).

For one field, Furrow compares rotations on profit (as a P10–P90 range), soil loss, soil carbon and pumped
water, replayed over 22 real seasons of NASA POWER weather. It lays out the trade-offs. The farmer and the
agronomist make the decision.

ML (Prithvi-EO-2.0 crop map, SMAP downscaling) lives in a separate repository. Its contract is in
[data/ml/README.md](data/ml/README.md).

## Run

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv numpy pymoo h3 pillow pytest
.venv/bin/python pipeline/fetch.py      # NASA POWER + SoilGrids per H3 cell, ~25 min, cached in data/raw
.venv/bin/python pipeline/fetch.py --smap   # SMAP L4 root-zone moisture from NASA GIBS, ~1 min, data/raw/*.smap.json
.venv/bin/python pipeline/build.py      # simulations, climate twin, NSGA-II -> web/public/data/*.json
.venv/bin/python pipeline/model.py      # model self-check
.venv/bin/python -m pytest pipeline     # priority numbers, SMAP check, ML contract
cd web && npm install && npm run dev    # http://localhost:5173
```

`npm run build` makes a static site in `web/dist`, with no backend.

## What is where

| Part | File | Status |
|---|---|---|
| Regions, H3 grid | `pipeline/regions.py` | done |
| NASA POWER daily weather, SoilGrids topsoil | `pipeline/fetch.py` | runs, no auth |
| SMAP L4 root-zone moisture (check of the water balance) | `pipeline/fetch.py --smap`, `build.py smap_check()` | runs, no auth |
| HLS NDVI, SMAP, IMERG, GRACE trend, SRTM slope, NEX-GDDP-CMIP6 deltas | `pipeline/gee_layers.py` | written, needs an Earth Engine project |
| Crop parameters, prices, strategies, N rates, market depth | `pipeline/crops.py` | assumptions, for an agronomist to replace |
| Farmer priorities: water, market, nitrogen, crop prices | `build.py farm()`, `web/src/App.tsx` Priorities | done |
| Water balance + yield, wind and water erosion, RothC | `pipeline/model.py` | done |
| Time machine, climate twin, NSGA-II, carbon, water | `pipeline/build.py` | done |
| Map with NASA GIBS layers, strategy cards, cockpit, assistant | `web/src` | done |
| ML layers | separate repo → `data/ml/<region>.json` | contract only |

## Models, honestly

- **Water and yield**: daily FAO-56 bucket (1.2 m), Hargreaves ET0, FAO-33 yield response (Ky), heat stress at
  flowering, rotation credits (after a legume +10%, cereal after cereal −8%), snow trapped by stubble.
  AquaCrop-OSPy can replace it per crop; the interfaces are `simulate()` and `run_strategy()`.
- **Wind erosion**: RWEQ-style index (erodible fraction × gust excess cubed × bare × dry). **Water erosion**: RUSLE
  with R from annual rain, K from texture, fixed LS until SRTM is wired. Both compare rotations; they are not
  absolute measurements.
- **Soil carbon**: RothC-26.3, monthly, initialised from SoilGrids SOC. The pools start near equilibrium, so read
  the *difference* between strategies, not the absolute trend.
- **Uncertainty**: every number is a spread over 22 weather years and every rotation start year. The climate twin
  shifts the record by ΔT/ΔP; the Earth Engine script computes the NEX-GDDP-CMIP6 SSP2-4.5 and SSP5-8.5 deltas per cell.
- **Carbon credits**: RothC difference × 44/12, 20% buffer, $15–35/t. Real payment needs measured samples and
  a registry methodology (for example Verra VM0042).
- **Farmer priorities**: four numbers per strategy, weighted by the farmer's sliders. Profit is the median at the
  chosen crop prices (±30%, revenue moves, costs stay). Water is pumped mm (Arizona) or the share of crop water
  demand not met (Kazakhstan). Market is the share of revenue from crops with a deep market. Nitrogen is mineral N
  bought, kg/ha a year, with 30 kg credited after a legume. N rates and market depth are assumptions in `crops.py`.
- **SMAP check**: the model's root-zone water at the reference field against SMAP L4 root-zone moisture on the
  next day, 2015–2024. SMAP values come from NASA GIBS images decoded through GIBS's published colour table
  (0.003 m³/m³ bins), so no Earthdata login is needed. Correlation is reported raw and with the seasonal cycle
  removed (about 0.6 and 0.55 in both regions). It checks the model; it does not drive it.
- **GPM IMERG**: map layer only. The GIBS daily image is not a daily total (June 2020 in East Kazakhstan: ~18 mm
  from the image against ~40 mm in POWER), so it is not used as a number. Real IMERG totals need an Earthdata
  login (GES DISC) or the Earth Engine script.
- **GRACE-FO**: on the map through NASA GIBS. A 300 km mascon cannot see a farm; the Earth Engine script gives the
  cell trend in cm/yr so pumping savings sit on the same scale.

## Limits

SMAP pixels are 9 km: the app never calls them your field's moisture. Prices and costs are round assumptions.
The four strategies per region are hypotheses for an agronomist to test, not recommendations.
