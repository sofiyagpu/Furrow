# Contract with the ML repo

The ML lives in a separate repository (Prithvi-EO-2.0 crop map, SMAP downscaling). This app does not train
anything. If the ML repo drops `data/ml/<region>.json` here (`az` or `vko`), `pipeline/build.py` embeds it and the
map shows an extra "ML" layer. No file, no layer, nothing breaks.

```json
{
  "model": "prithvi-eo-2.0 + terratorch, fine-tuned on CDL 2023",
  "version": "2026-11-15",
  "validation": "F1 0.81 on held-out Kansas counties; transfer to VKO not validated",
  "cells": {
    "8548e827fffffff": {
      "crop": "wheat",
      "crop_p": 0.74,
      "sm_rootzone": 0.21,
      "sm_rootzone_pi": [0.17, 0.25]
    }
  }
}
```

- `cells` keys are H3 resolution 5 cells (`pipeline/regions.py`).
- Every field per cell is optional. `crop`: dominant class; `crop_p`: its probability; `sm_rootzone`:
  downscaled volumetric soil moisture (m3/m3), `sm_rootzone_pi`: its prediction interval.
- `validation` is shown in the app as written, so write it honestly.
