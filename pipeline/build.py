"""Precompute everything the web app shows: web/public/data/<region>.json
    .venv/bin/python pipeline/build.py [az|vko]
    .venv/bin/python pipeline/build.py --ml-only az [path/to/ml.json]   # re-embed ML only, models untouched
"""
import json, sys, time
from pathlib import Path
import numpy as np
import h3
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import ElementwiseProblem
from pymoo.operators.crossover.sbx import SBX
from pymoo.operators.mutation.pm import PM
from pymoo.operators.repair.rounding import RoundingRepair
from pymoo.operators.sampling.rnd import IntegerRandomSampling
from pymoo.optimize import minimize

from crops import CROPS, STRATEGIES, CO2_PRICE, IRRIGATION, PUMP_COST, N_RATE, N_CREDIT, MARKET
from model import Weather, run_strategy, summarise
from regions import REGIONS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data"
ML = ROOT / "data" / "ml"  # contract with the separate ML repo, see data/ml/README.md


def load_ml(path):
    """ML file from the separate repo (data/ml/README.md). Every field is optional: no file -> None,
    missing or malformed `cells` -> {}. Broken JSON fails loudly so a bad export is not silently dropped."""
    path = Path(path)
    if not path.exists():
        return None
    try:
        ml = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: not valid JSON ({e})")
    if not isinstance(ml, dict):
        raise SystemExit(f"{path}: expected a JSON object")
    if not isinstance(ml.get("cells"), dict):
        ml["cells"] = {}
    return ml


def embed_ml(rid, path=None):
    """Swap the ML block of an already built region file; strategies, model and NSGA-II results stay as they are."""
    out = OUT / f"{rid}.json"
    data = json.loads(out.read_text())
    data["ml"] = load_ml(path or ML / f"{rid}.json")
    known = {c["h3"] for c in data["cells"]}
    cells = (data["ml"] or {}).get("cells", {})
    stray = [h for h in cells if h not in known]
    if stray:
        print(f"{rid}: {len(stray)} ML cells are not in the region grid and will not show: {stray[:3]}")
    out.write_text(json.dumps(data, separators=(",", ":")))
    print(rid, "ml:", "none" if data["ml"] is None else f"{len(cells)} cells")


def r1(x):
    return round(float(x), 1)


def climatology(wx):
    m = wx.month
    yrs = len(set(wx.year))
    return [dict(month=i, rain=r1(wx.p[m == i].sum() / yrs), tmean=r1(((wx.tx + wx.tn) / 2)[m == i].mean()),
                 et0=r1(wx.et0[m == i].sum() / yrs), wind=round(float(wx.wind[m == i].mean()), 2)) for i in range(1, 13)]


def rep_cell(cells):
    soc = np.median([c["soil"]["soc"] for c in cells.values()])
    return min(cells, key=lambda k: abs(cells[k]["soil"]["soc"] - soc))


def time_machine(rows, seasons):
    """Per year: band across rotation phases + the crop the phase-0 field had."""
    by = {}
    for r in rows:
        by.setdefault(r["year"], []).append(r)
    crop_of = {}
    for s in seasons:
        crop_of.setdefault(s["year"], []).append(dict(crop=s["crop"], yield_t=round(s["yield"], 2), profit=r1(s["profit"]),
                                                      irr=r1(s["irr"]), eta=r1(s["eta"]), etc=r1(s["etc"])))
    out = []
    for y in sorted(by):
        p = np.array([r["profit"] for r in by[y]])
        ph0 = next((r for r in by[y] if r["phase"] == 0), by[y][0])
        out.append(dict(year=y, profit=[r1(v) for v in np.percentile(p, [10, 50, 90])], crops=crop_of.get(y, []),
                        wind=round(ph0["wind"], 2), irr=r1(ph0["irr"]), soc=round(ph0["soc"], 2), bare=ph0["bare"]))
    return out


def canonical(rot):
    """Same rotation however it is written: shortest repeating period, start from the first cash crop
    in alphabetical order (run_strategy averages over every start year anyway)."""
    n = len(rot)
    for k in range(1, n + 1):
        if n % k == 0 and rot == rot[:k] * (n // k):
            rot = rot[:k]
            break
    return min((rot[i:] + rot[:i] for i in range(len(rot))), default=rot)


class RotationProblem(ElementwiseProblem):
    def __init__(self, region, wx, soil):
        self.region, self.wx, self.soil = region, wx, soil
        self.names = [k for k in CROPS[region]]
        self.irrigated = REGIONS[region]["irrigated"]
        n_slots = 4
        xu = [len(self.names)] * n_slots + [1] + ([1] if self.irrigated else [])
        n_obj = 5 if self.irrigated else 4
        super().__init__(n_var=len(xu), n_obj=n_obj, n_ieq_constr=1, xl=0, xu=xu, vtype=int)
        self.cache = {}

    def decode(self, x):
        x = [int(round(v)) for v in x]
        rot = canonical([self.names[i] for i in x[:4] if i < len(self.names)])
        s = dict(rotation=rot, notill=bool(x[4]))
        if self.irrigated:
            s["irrigation"] = "drip" if x[5] else "flood"
        return s

    def score(self, s):
        key = json.dumps(s, sort_keys=True)
        if key not in self.cache:
            rows, _, _, dsoc, _ = run_strategy(s, self.wx, self.soil, self.region)
            self.cache[key] = summarise(rows, dsoc)
        return self.cache[key]

    def _evaluate(self, x, out, *a, **k):
        s = self.decode(x)
        rot = s["rotation"]
        cash = [c for c in rot if CROPS[self.region][c]["ymax"] > 0]
        # at least 2 slots, one cash crop, no crop three times in a row (cyclic)
        bad = len(rot) < 2 or not cash or any(rot[i] == rot[(i + 1) % len(rot)] == rot[(i + 2) % len(rot)] for i in range(len(rot)))
        if bad:
            out["F"] = [1e4] * self.n_obj
            out["G"] = [1]
            return
        m = self.score(s)
        f = [-m["profit_mean"], -m["profit"][0], m["erosion"], -m["dsoc"]]
        if self.irrigated:
            f.append(m["irr"][1])
        out["F"] = f
        out["G"] = [-1]


def pareto(region, wx, soil):
    prob = RotationProblem(region, wx, soil)
    alg = NSGA2(pop_size=48, sampling=IntegerRandomSampling(),
                crossover=SBX(prob=0.9, eta=3, vtype=float, repair=RoundingRepair()),
                mutation=PM(prob=0.3, eta=3, vtype=float, repair=RoundingRepair()), eliminate_duplicates=True)
    res = minimize(prob, alg, ("n_gen", 30), seed=1, verbose=False)
    seen, out = set(), []
    for x in np.atleast_2d(res.X):
        s = prob.decode(x)
        key = json.dumps(s, sort_keys=True)
        if key in seen or not s["rotation"]:
            continue
        seen.add(key)
        out.append(dict(**s, metrics=prob.score(s)))
    # also every point evaluated, for the cloud behind the front
    cloud = [dict(**json.loads(k), metrics=v) for k, v in prob.cache.items()]
    return out, cloud


def carbon(dsoc_vs_base):
    """Soil-carbon credit estimate from RothC difference to current practice. 20% buffer pool held back."""
    t_co2 = max(0.0, dsoc_vs_base) * 44 / 12 * 0.8
    return dict(t_co2_ha_yr=round(t_co2, 2), usd_ha_yr=[r1(t_co2 * CO2_PRICE[0]), r1(t_co2 * CO2_PRICE[1])])


def farm(seasons, rid):
    """Priority numbers from the phase-0 seasons: revenue (for the price slider), mineral N, market depth, water stress."""
    crops, n_rate = CROPS[rid], N_RATE[rid]
    years = max(1, seasons[-1]["year"] - seasons[0]["year"] + 1) if seasons else 1
    n, rev, deep, stress, prev = 0.0, 0.0, 0.0, [], None
    for x in seasons:
        c = x["crop"]
        n += max(0, n_rate[c] - (N_CREDIT if prev and crops[prev].get("fix") else 0))
        rev += x["revenue"]
        deep += x["revenue"] if MARKET[rid].get(c) == "deep" else 0
        if crops[c]["ymax"] > 0 and x["etc"] > 0:
            stress.append(1 - x["eta"] / x["etc"])
        prev = c
    return dict(revenue=r1(rev / years), n_kg=r1(n / years), deep_market=round(float(deep / rev), 2) if rev else None,
                water_stress=round(float(np.mean(stress)), 2) if stress else None)


def smap_check(rid, h3_cell, dekads):
    """Model root-zone water (mm, dekad mean) against SMAP L4 root-zone moisture (m3/m3) on the next day.
    r on the raw series rewards the shared seasonal cycle; r on monthly anomalies is the stricter test."""
    path = ROOT / "data" / "raw" / f"{rid}.smap.json"
    if not path.exists():
        return None
    sm = json.loads(path.read_text())
    obs = dict(zip(sm["dates"], sm["cells"].get(h3_cell, [])))
    pairs = []
    for d, sw, *_ in dekads:
        nxt = (np.datetime64(d) + np.timedelta64(1, "D")).astype(str)
        if obs.get(nxt) is not None:
            pairs.append((nxt, obs[nxt], sw))
    if len(pairs) < 24:
        return None
    a = np.array([[p[1], p[2]] for p in pairs], float)
    month = np.array([int(p[0][5:7]) for p in pairs])
    anom = a.copy()
    for m in range(1, 13):
        anom[month == m] -= a[month == m].mean(axis=0)
    r = lambda x: round(float(np.corrcoef(x[:, 0], x[:, 1])[0, 1]), 2)  # noqa: E731
    return dict(layer=sm["layer"], n=len(pairs), r=r(a), r_anom=r(anom), series=[[d, o, m] for d, o, m in pairs])


def imerg_power(power, monthly):
    """POWER daily series with each month's rain scaled to the IMERG monthly total (keeps POWER's rain days).
    ponytail: a month POWER calls dry (< 1 mm) stays as POWER has it; IMERG daily would fill those, at 30x the downloads."""
    months = {m: x for m, x in zip(monthly["months"], monthly["mm"])}
    tot = {}
    for d, x in zip(power["dates"], power["PRECTOTCORR"]):
        if x >= 0:
            tot[d[:6]] = tot.get(d[:6], 0.0) + x
    scale = {k: months[f"{k[:4]}-{k[4:]}"] / v for k, v in tot.items() if v >= 1 and f"{k[:4]}-{k[4:]}" in months}
    return {**power, "PRECTOTCORR": [x * scale.get(d[:6], 1.0) if x >= 0 else x for d, x in zip(power["dates"], power["PRECTOTCORR"])]}


def imerg_check(rid, raw, c, strategies, years):
    """Same strategies, same field, rain from GPM IMERG instead of NASA POWER. The headline numbers stay on POWER."""
    path = ROOT / "data" / "raw" / f"{rid}.imerg.json"
    if not path.exists():
        return None
    im = json.loads(path.read_text())
    monthly = dict(months=im["months"], mm=im["power"][c["power"]])
    power = raw["power"][c["power"]]
    wx = Weather(imerg_power(power, monthly), c["lat"])
    out = {}
    for s in strategies:
        rows, _, _, dsoc, _ = run_strategy(s, wx, c["soil"], rid)
        m = summarise(rows, dsoc)
        out[s["id"]] = dict(profit=m["profit"], loss_years=m["loss_years"], erosion=m["erosion"], irr=m["irr"][1])
    rain = {}
    for d, x in zip(power["dates"], power["PRECTOTCORR"]):
        if x >= 0:
            rain.setdefault(int(d[:4]), [0.0, 0.0])[0] += x
    for mth, x in zip(monthly["months"], monthly["mm"]):
        if int(mth[:4]) in rain:
            rain[int(mth[:4])][1] += x
    yrs = [y for y in sorted(rain) if years[0] <= y <= years[1]]
    return dict(product=im["product"], strategies=out, years=[[y, r1(rain[y][0]), r1(rain[y][1])] for y in yrs],
                ratio=round(sum(rain[y][1] for y in yrs) / sum(rain[y][0] for y in yrs), 2))


def compute(rid, region, raw, checks=True):
    """The whole region file from raw inputs ({"cells": {h3: {lat, lon, soil, power, b?}}, "power": {key: series}}).
    rid picks the crops and strategies; checks=False skips SMAP, IMERG and ML, which exist only for the demo regions."""
    t0 = time.time()
    cells = {k: v for k, v in raw["cells"].items() if v["soil"]}
    wxs = {k: Weather(v, float(k.split(",")[0])) for k, v in raw["power"].items()}
    rep = rep_cell(cells)
    strategies = STRATEGIES[rid]

    out_cells = []
    for h, c in cells.items():
        res = {}
        for s in strategies:
            rows, _, _, dsoc, soc0 = run_strategy(s, wxs[c["power"]], c["soil"], rid)
            m = summarise(rows, dsoc)
            res[s["id"]] = {k: m[k] for k in ("profit", "erosion", "dsoc", "irr", "bare_days", "loss_years")}
        out_cells.append(dict(h3=h, lat=round(c["lat"], 4), lon=round(c["lon"], 4),
                              b=c.get("b") or [[round(lo, 4), round(la, 4)] for la, lo in h3.cell_to_boundary(h)],
                              soil={k: round(v, 2) for k, v in c["soil"].items()}, soc0=round(soc0, 1), s=res))
    print(rid, "cells", round(time.time() - t0), "s")

    c = cells[rep]
    wx = wxs[c["power"]]
    out_strat, base = [], None
    for s in strategies:
        rows, seasons, dek, dsoc, soc0 = run_strategy(s, wx, c["soil"], rid, dekads=True)
        m = summarise(rows, dsoc)
        base = base if base is not None else m
        out_strat.append(dict(**s, metrics=m, timeline=time_machine(rows, seasons), dekads=dek,
                              carbon=carbon(m["dsoc"] - base["dsoc"]),
                              water_saved_mm=r1(base["irr"][1] - m["irr"][1]), farm=farm(seasons, rid)))
    print(rid, "strategies", round(time.time() - t0), "s")

    twin = dict(dT=[0, 1, 2, 3], dP=[-0.2, -0.1, 0, 0.1], grid={})
    for s in strategies:
        g = []
        for dT in twin["dT"]:
            row = []
            for dP in twin["dP"]:
                w2 = Weather(raw["power"][c["power"]], c["lat"], dT, dP)
                rows, _, _, dsoc, _ = run_strategy(s, w2, c["soil"], rid)
                m = summarise(rows, dsoc)
                row.append(dict(profit=m["profit"], erosion=m["erosion"], irr=m["irr"][1], loss_years=m["loss_years"]))
            g.append(row)
        twin["grid"][s["id"]] = g
    print(rid, "twin", round(time.time() - t0), "s")

    front, cloud = pareto(rid, wx, c["soil"])
    print(rid, "pareto", len(front), "of", len(cloud), round(time.time() - t0), "s")

    yrs = [int(wx.year.min()) + 1, int(wx.year.max()) - 1]
    return dict(
        id=rid, name=region["name"], name_ru=region["name_ru"], bbox=region["bbox"], irrigated=region["irrigated"],
        years=yrs,
        rep_cell=rep, climate=climatology(wx),
        crops={k: dict(label=v["label"], label_ru=v["label_ru"], price=v["price"], cost=v["cost"], ymax=v["ymax"], family=v["family"],
                       n=N_RATE[rid][k], market=MARKET[rid].get(k)) for k, v in CROPS[rid].items()},
        assumptions=dict(co2_price=CO2_PRICE, buffer=0.2, pump_cost_m3=PUMP_COST, irrigation_eff=IRRIGATION, n_credit=N_CREDIT),
        cells=out_cells, strategies=out_strat, twin=twin, pareto=front, cloud=cloud,
        smap=smap_check(rid, rep, out_strat[0]["dekads"]) if checks else None,
        imerg=imerg_check(rid, raw, c, strategies, yrs) if checks else None,
        ml=load_ml(ML / f"{rid}.json") if checks else None,
    )


def build(rid):
    t0 = time.time()
    data = compute(rid, REGIONS[rid], json.loads((ROOT / "data" / "raw" / f"{rid}.json").read_text()))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{rid}.json").write_text(json.dumps(data, separators=(",", ":"), default=lambda o: o.item()))
    print(rid, "done", round(time.time() - t0), "s", round((OUT / f"{rid}.json").stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--ml-only"]:
        embed_ml(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        for rid in sys.argv[1:] or list(REGIONS):
            build(rid)
