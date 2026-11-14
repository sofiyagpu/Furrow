"""Precompute everything the web app shows: web/public/data/<region>.json
    .venv/bin/python pipeline/build.py [az|vko]
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

from crops import CROPS, STRATEGIES, CO2_PRICE, IRRIGATION, PUMP_COST
from model import Weather, run_strategy, summarise
from regions import REGIONS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "data"
ML = ROOT / "data" / "ml"  # contract with the separate ML repo, see data/ml/README.md


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


def build(rid):
    t0 = time.time()
    region = REGIONS[rid]
    raw = json.loads((ROOT / "data" / "raw" / f"{rid}.json").read_text())
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
                              b=[[round(lo, 4), round(la, 4)] for la, lo in h3.cell_to_boundary(h)],
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
                              water_saved_mm=r1(base["irr"][1] - m["irr"][1])))
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

    ml = ML / f"{rid}.json"
    data = dict(
        id=rid, name=region["name"], name_ru=region["name_ru"], bbox=region["bbox"], irrigated=region["irrigated"],
        years=[int(wx.year.min()) + 1, int(wx.year.max()) - 1],
        rep_cell=rep, climate=climatology(wx),
        crops={k: dict(label=v["label"], label_ru=v["label_ru"], price=v["price"], cost=v["cost"], ymax=v["ymax"], family=v["family"]) for k, v in CROPS[rid].items()},
        assumptions=dict(co2_price=CO2_PRICE, buffer=0.2, pump_cost_m3=PUMP_COST, irrigation_eff=IRRIGATION),
        cells=out_cells, strategies=out_strat, twin=twin, pareto=front, cloud=cloud,
        ml=json.loads(ml.read_text()) if ml.exists() else None,
    )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{rid}.json").write_text(json.dumps(data, separators=(",", ":"), default=lambda o: o.item()))
    print(rid, "done", round(time.time() - t0), "s", round((OUT / f"{rid}.json").stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    for rid in sys.argv[1:] or list(REGIONS):
        build(rid)
