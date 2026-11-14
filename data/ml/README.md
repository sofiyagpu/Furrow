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
      "low_confidence": false,
      "years": { "2021": { "crop": "string", "bare_obs_dates": 0 } }
    }
  }
}
```

- `cells` keys are H3 resolution 5 cells of the region grid (`pipeline/regions.py`). Keys outside the grid are
  ignored; `build.py --ml-only` lists them.
- `crop`: dominant class key. The app has display names for `alfalfa`, `corn`, `cotton`, `fallow`, `barley` and
  `wheat`; any other key is shown as written. These are labels only: the strategy model's crops are separate.
- `crop_pixel_share`: share of the cell's pixels in `crop`, 0–1. Shown as "pixel share". If it is missing, `crop_p`
  is shown under the same label.
- `low_confidence`: `true` adds a "low confidence" mark.
- `years`: per-year class, and `bare_obs_dates` = number of satellite dates the cell was seen bare that year.
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
