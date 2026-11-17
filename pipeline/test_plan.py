"""Whole-farm plan: machinery and contracts bind, excluded crops stay out. Three East Kazakhstan cells as fields. ~30 s."""
import json
import numpy as np
import plan
from build import ROOT

RAW = json.loads((ROOT / "data" / "raw" / "vko.json").read_text())


def farm(**kw):
    cells = [c for c in RAW["cells"].values() if c["soil"]][:3]
    fields = []
    for i, c in enumerate(cells):
        lo, la = c["lon"], c["lat"]
        ring = [[lo, la], [lo + 0.04, la], [lo + 0.04, la + 0.02], [lo, la + 0.02]]  # ~630 ha each
        wx = plan.Weather(RAW["power"][c["power"]], la)
        fields.append(dict(name=f"F{i}", ring=ring, area=plan.area_ha(ring), soil=c["soil"], wx=wx, wx_stress=wx))
    return plan.Farm("vko", fields, **kw)


def test_plan():
    assert 600 < plan.area_ha([[82, 50.5], [82.04, 50.5], [82.04, 50.52], [82, 50.52]]) < 660

    f = farm(seed_ha_day=60, harvest_ha_day=60, exclude=["rapeseed"])
    area = f.area.sum()
    # current practice sows wheat on 2/3 of the farm in May: more drilling days than a month has at 60 ha/day
    base = f.report(f.baseline(), "current")
    assert area * 2 / 3 / 60 > plan.WORK_DAYS and not base["feasible"] and base["overload_days"] > 0

    plans = plan.optimise(f, pop=40, gens=40)
    assert plans and all(p["feasible"] for p in plans)
    for p in plans:
        assert p["machinery"]["sow_peak"] <= plan.WORK_DAYS and p["machinery"]["harvest_peak"] <= plan.WORK_DAYS
        assert not any("rapeseed" in fl["rotation"] for fl in p["fields"])
        assert abs(sum(p["plan_years"][0]["crops"].values()) - area) < 2 * len(f.fields), "every hectare has a crop"
    best = max(plans, key=lambda p: p["profit_mean"])
    assert best["profit_mean"] > base["profit_mean"]

    # wheat every year, but the elevator takes at most 0.6 of what current practice (2 of 3 fields) grows:
    # one wheat field a year, so the fields must be staggered. Bigger drill and combine: at 60 ha/day two May-sown
    # fields already miss the month, and that together with the cap leaves no plan (checked by hand)
    f.seed = f.comb = 200
    f.contracts = [dict(crop="wheat", min_t=1)]
    cap = 0.6 * f.report(f.baseline(), "current")["contracts"][0]["planned"][1]
    f.contracts = [dict(crop="wheat", min_t=1, max_t=cap)]
    p = plan.optimise(f, pop=40, gens=40)
    assert p and all(x["feasible"] for x in p)
    assert all(1 <= x["contracts"][0]["planned"][0] and x["contracts"][0]["planned"][1] <= cap for x in p)

    f.contracts = [dict(crop="wheat", min_t=1e6)]  # cannot be met: one plan, the closest, flagged
    (p,) = plan.optimise(f, pop=20, gens=10)
    assert p["key"] == "closest" and not p["feasible"] and p["shortfall_t"] > 0
    assert np.isfinite(p["stress"]["profit"]).all()
