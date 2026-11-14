# Contract with the ML repo (carver-ml)

The ML lives in the separate `carver-ml` repository. This app trains nothing. carver-ml writes
`data/ml/<region>.json` here (`az` or `vko`), and `pipeline/build.py` embeds it into `web/public/data/<region>.json`.
The app shows it in the map's cell panel (click a cell) and in the ML section. With no file, an empty `cells` or a
missing field, the page still works and the panel says "No ML data for this cell".

## Format

Every field except `cells` may be missing; every field inside a cell is optional.

```json
{
  "model": "string",
  "version": "string",
  "validation": "string",
  "cells": {
    "<h3 res 5>": {
      "crop": "string",
      "crop_p": 0.0,
      "crop_pixel_share": 0.0,
      "crop_top": "string",
      "crop_top_share": 0.0,
      "low_confidence": false,
      "years": {
        "2020": { "crop": "string", "source": "USDA CDL" },
        "2021": { "crop": "string", "source": "model", "bare_obs_dates": 0, "bare_months": [4, 5], "low_obs_months": [7] }
      }
    }
  },
  "detail": { "h3_resolution": 8, "cells": { "<h3 res 8>": { "...": "same fields as a cell" } } }
}
```

- `cells` keys are H3 resolution 5 cells of the region grid (`pipeline/regions.py`). Keys outside the grid are
  ignored; `build.py --ml-only` lists them.
- `crop`: dominant class key, or a composition such as `"fallow 29%, alfalfa 20%, corn 19%"`. The app has display
  names for `alfalfa`, `corn`, `cotton`, `fallow`, `barley`, `wheat` and `small_grains` (also inside a composition);
  any other key is shown as written. These are labels only: the strategy model's crops are separate.
- `crop_pixel_share`: share of the cell's pixels in `crop`, 0–1. Shown as "pixel share". If it is missing, `crop_p`
  is shown under the same label.
- `crop_top`, `crop_top_share`: the cell's largest class as one key and its pixel share. When present, the panel
  headline uses them (with `crop` underneath), and the detail map is coloured by `crop_top`.
- `low_confidence`: `true` adds a "low confidence" mark.
- `years`: per-year class. `source` is shown next to it (`USDA CDL` = fact, `model` = prediction). `bare_months`
  (1–12) is shown as "bare: Apr, May"; `low_obs_months` as "too few images"; without `bare_months`,
  `bare_obs_dates` (satellite dates seen bare) is shown instead.
- `detail` (optional): the same cell fields on finer H3 cells, drawn as a crop map on top of the grid with a toggle in
  the map legend. `build.py` adds each detail cell's outline (`b`) and its grid cell (`p`), so the app needs no H3
  library; detail cells outside the region grid are dropped from the map and listed by `build.py --ml-only`. Clicking
  one opens its grid cell and shows that detail cell in the panel.
- `validation`: shown in the app exactly as written. Report how the model was checked on this region; if it was
  not, say so.

## Updating

```bash
.venv/bin/python pipeline/build.py --ml-only az          # re-embed data/ml/az.json; models are not re-run
.venv/bin/python pipeline/build.py az                     # full rebuild also embeds it
.venv/bin/python -m pytest pipeline/test_ml.py            # contract checks
```

`data/ml/fixtures/` holds test files with invented values (`az.one-cell.json`). They are never read by the build on
their own; use them only for a local check (`--ml-only az data/ml/fixtures/az.one-cell.json`) and re-embed the real
file afterwards. Never copy fixture cells into `data/ml/<region>.json`.
