"""Whole-farm plan: one rotation, practice and start phase per field, chosen by NSGA-II for the farm as a whole,
under the farm's machinery and sales contracts.

Every field is simulated once per candidate (rotation, practice, phase) over the weather record; the search then only
adds up those per-year tables, area-weighted. Fields start their rotations in the same record year, so staggering
phases between fields shows up in the farm's yearly totals, contract tonnage and machinery load.

Machinery: drilling and combining days per calendar month must fit in WORK_DAYS; no-till and drip only with the kit.
Contracts: planned tonnage of a crop (area x the field's median yield of that crop) within [min_t, max_t] every year.
The weather replay then says how often the real harvest would have met the contract.
"""
import json
import numpy as np
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import ElementwiseProblem
from pymoo.operators.crossover.sbx import SBX
from pymoo.operators.mutation.pm import PM
from pymoo.operators.repair.rounding import RoundingRepair
from pymoo.optimize import minimize

from build import OUT, canonical
from crops import CROPS, STRATEGIES
from model import Weather, simulate
from regions import REGIONS

WORK_DAYS = 20  # workable field days in a month (weather, breakdowns): an assumption, like the prices
PLAN_YEARS = 6  # years shown in the field-by-year plan


def candidates(rid, notill, drip, exclude):
    """Current practice first, then the region's strategies and its NSGA-II front, each with every practice the
    farm's machinery allows. Rotations with an excluded crop (no kit, no buyer) are left out, except current practice,
    which is kept as the baseline. Returns (options, allowed indices)."""
    irrigated = REGIONS[rid]["irrigated"]
    cur = STRATEGIES[rid][0]
    opts = [dict(rotation=list(cur["rotation"]), notill=cur["notill"], irrigation=cur.get("irrigation"), id="current")]
    names = {tuple(canonical(list(s["rotation"]))): s["id"] for s in STRATEGIES[rid]}
    front = json.loads((OUT / f"{rid}.json").read_text())["pareto"]
    rots = list(dict.fromkeys(tuple(canonical(list(s["rotation"]))) for s in STRATEGIES[rid] + front))
    for rot in rots:
        if set(rot) & set(exclude):
            continue
        for nt in ([False, True] if notill else [False]):
            for irr in ((["flood", "drip"] if drip else ["flood"]) if irrigated else [None]):
                o = dict(rotation=list(rot), notill=nt, irrigation=irr, id=names.get(rot))
                if not (o["id"] == "current" and nt == cur["notill"] and irr == cur.get("irrigation")):  # already opts[0]
                    opts.append(o)
    allowed = [i for i, o in enumerate(opts) if (notill or not o["notill"]) and (drip or o["irrigation"] != "drip")
               and not set(o["rotation"]) & set(exclude)]
    return opts, allowed


def tables(opt, wx, soil, rid, years, crop_keys):
    """Per phase: per-year arrays for one hectare of this field under this option."""
    crops, Y, C = CROPS[rid], len(years), len(crop_keys)
    y0, ci = years[0], {c: i for i, c in enumerate(crop_keys)}
    out, yields = [], {}
    for ph in range(len(opt["rotation"])):
        r = simulate(opt["rotation"], wx, soil, rid, opt["notill"], opt["irrigation"], ph)
        T = dict(profit=np.zeros(Y), revenue=np.zeros(Y), cost=np.zeros(Y), tons=np.zeros((Y, C)), n=np.zeros((Y, C)),
                 sow=np.zeros((Y, 12)), harvest=np.zeros((Y, 12)), crops=[[] for _ in range(Y)])
        prev = None
        for s in r["seasons"]:
            c, k = crops[s["crop"]], s["year"] - y0
            sow_y, sow_m = int(s["start"][:4]) - y0, int(s["start"][5:7]) - 1
            if 0 <= sow_y < Y and c["family"] != "fallow" and not (c.get("perennial") and prev == s["crop"]):
                T["sow"][sow_y, sow_m] = 1
            prev = s["crop"]
            if not 0 <= k < Y:
                continue
            T["profit"][k] += s["profit"]
            T["revenue"][k] += s["revenue"]
            T["cost"][k] += s["cost"]
            T["crops"][k].append(s["crop"])
            if c["ymax"] > 0:
                T["tons"][k, ci[s["crop"]]] += s["yield"]
                T["n"][k, ci[s["crop"]]] += 1
                yields.setdefault(s["crop"], []).append(s["yield"])
                if c["family"] != "forage":  # hay is mown, not combined
                    T["harvest"][k, int(s["harvest"][5:7]) - 1] = 1
        Yr = [r["years"][y] for y in years]
        soc = [x.get("soc", r["soc0"]) for x in Yr]
        T.update(erosion=float(np.mean([x["wind"] + x["water"] for x in Yr])), irr=float(np.mean([x["irr"] for x in Yr])),
                 dsoc=(soc[-1] - soc[0]) / max(1, Y - 1))
        out.append(T)
    med = np.array([np.median(yields[c]) if c in yields else 0.0 for c in crop_keys])
    for T in out:
        T["planned"] = T.pop("n") * med  # tonnage a farmer can plan on: median yield, not this year's weather
    return out


def area_ha(ring):
    """Polygon area, local equirectangular projection: fine at field size."""
    lat0 = np.radians(np.mean([p[1] for p in ring]))
    x = np.array([p[0] for p in ring]) * 111320 * np.cos(lat0)
    y = np.array([p[1] for p in ring]) * 110540
    return float(abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) / 2 / 1e4)


class Farm:
    """fields: [{name, area, wx, wx_stress, soil}]. Everything the search and the report need, precomputed."""

    def __init__(self, rid, fields, seed_ha_day, harvest_ha_day, notill=False, drip=False, exclude=(), contracts=()):
        self.rid, self.fields = rid, fields
        self.seed, self.comb = seed_ha_day, harvest_ha_day
        self.contracts = list(contracts)
        self.crop_keys = list(CROPS[rid])
        self.opts, self.allowed = candidates(rid, notill, drip, exclude)
        if not self.allowed:
            raise ValueError("no rotation fits: every candidate uses an excluded crop or missing machinery")
        wx = fields[0]["wx"]
        self.years = list(range(int(wx.year.min()) + 1, int(wx.year.max())))  # full years only
        self.area = np.array([f["area"] for f in fields])
        self.T = [[tables(o, f["wx"], f["soil"], rid, self.years, self.crop_keys) for o in self.opts] for f in fields]
        self.irrigated = any(o["irrigation"] for o in self.opts)

    def pick(self, x):
        """Decision vector -> [(option index, phase)] per field."""
        F = len(self.fields)
        return [(self.allowed[int(x[i])], int(x[F + i]) % len(self.opts[self.allowed[int(x[i])]]["rotation"])) for i in range(F)]

    def totals(self, plan):
        rows = [self.T[f][o][p] for f, (o, p) in enumerate(plan)]
        s = lambda k: sum(a * r[k] for a, r in zip(self.area, rows))  # noqa: E731
        return rows, dict(profit=s("profit"), revenue=s("revenue"), cost=s("cost"), tons=s("tons"), planned=s("planned"),
                          sow=s("sow") / self.seed, harvest=s("harvest") / self.comb,
                          erosion=s("erosion"), dsoc=s("dsoc"), irr=s("irr") * 10)  # irr: mm x ha -> m3

    def violations(self, t, agg=np.sum):
        """Contract tonnes missed and machine days over the month, summed (the search) or the worst year/month (agg=np.max)."""
        short = np.zeros(len(self.years))
        for c in self.contracts:
            got = t["planned"][:, self.crop_keys.index(c["crop"])]
            short += np.maximum(0, (c.get("min_t") or 0) - got)
            if c.get("max_t") is not None:
                short += np.maximum(0, got - c["max_t"])
        over = np.maximum(0, np.concatenate([t["sow"], t["harvest"]]) - WORK_DAYS)
        return float(agg(short)), float(agg(over))

    def objectives(self, t):
        f = [-t["profit"].mean(), -np.percentile(t["profit"], 10), t["erosion"], -t["dsoc"]]
        return f + [t["irr"]] if self.irrigated else f

    def baseline(self):
        """Everyone on current practice, phases staggered so the farm has every crop of it each year."""
        L = len(self.opts[0]["rotation"])
        return [(0, f % L) for f in range(len(self.fields))]

    def report(self, plan, key):
        rows, t = self.totals(plan)
        short, over = self.violations(t, np.max)  # worst year, worst month: what a farmer can act on
        p = t["profit"]
        worst = int(np.argmin(p))
        contracts = []
        for c in self.contracts:
            j = self.crop_keys.index(c["crop"])
            real = t["tons"][:, j]
            ok = (real >= (c.get("min_t") or 0)) & ((real <= c["max_t"]) if c.get("max_t") is not None else True)
            contracts.append(dict(c, planned=[round(float(t["planned"][:, j].min())), round(float(t["planned"][:, j].max()))],
                                  met_share=round(float(ok.mean()), 2)))
        stress = sum(a * self.stress_profit(f, o, ph) for f, (a, (o, ph)) in enumerate(zip(self.area, plan)))
        H = min(PLAN_YEARS, len(self.years))
        return dict(
            key=key, feasible=short == 0 and over == 0, shortfall_t=round(short), overload_days=round(over, 1),
            fields=[dict(**{k: self.opts[o][k] for k in ("rotation", "notill", "irrigation", "id")}, phase=ph,
                         years=r["crops"][:H], profit=[round(float(v)) for v in np.percentile(r["profit"], [10, 50, 90])])
                    for (o, ph), r in zip(plan, rows)],
            profit=[round(float(v)) for v in np.percentile(p, [10, 50, 90])], profit_mean=round(float(p.mean())),
            loss_years=round(float((p < 0).mean()), 2), worst=[self.years[worst], round(float(p[worst]))],
            erosion=round(float(t["erosion"]), 1), dsoc=round(float(t["dsoc"]), 2), irr_m3=round(float(t["irr"])),
            years=[[y, round(float(a)), round(float(b)), round(float(c))] for y, a, b, c in zip(self.years, p, t["revenue"], t["cost"])],
            stress=dict(dT=2, dP=-0.1, profit=[round(float(v)) for v in np.percentile(stress, [10, 50, 90])],
                        loss_years=round(float((stress < 0).mean()), 2)),
            contracts=contracts,
            machinery=dict(work_days=WORK_DAYS, sow_peak=round(float(t["sow"].max()), 1), harvest_peak=round(float(t["harvest"].max()), 1),
                           sow=[round(float(v), 1) for v in t["sow"].max(axis=0)], harvest=[round(float(v), 1) for v in t["harvest"].max(axis=0)]),
            plan_years=[dict(crops={c: round(float(sum(a for a, r in zip(self.area, rows) if c in r["crops"][k]))) for c in self.crop_keys
                                    if any(c in r["crops"][k] for r in rows)},
                             tons={c: round(float(t["planned"][k, j])) for j, c in enumerate(self.crop_keys) if t["planned"][k, j] > 0})
                        for k in range(H)],
        )

    def stress_profit(self, f, o, ph):
        """+2 C, 10% less rain: the climate twin's middle scenario, for this field's choice only."""
        fd, opt = self.fields[f], self.opts[o]
        r = simulate(opt["rotation"], fd["wx_stress"], fd["soil"], self.rid, opt["notill"], opt["irrigation"], ph)
        out = np.zeros(len(self.years))
        for s in r["seasons"]:
            if self.years[0] <= s["year"] <= self.years[-1]:
                out[s["year"] - self.years[0]] += s["profit"]
        return out


class FarmProblem(ElementwiseProblem):
    def __init__(self, farm):
        self.farm = farm
        F, L = len(farm.fields), max(len(farm.opts[i]["rotation"]) for i in farm.allowed)
        n_obj = 5 if farm.irrigated else 4
        super().__init__(n_var=2 * F, n_obj=n_obj, n_ieq_constr=2, xl=0, xu=[len(farm.allowed) - 1] * F + [L - 1] * F, vtype=int)

    def _evaluate(self, x, out, *a, **k):
        _, t = self.farm.totals(self.farm.pick(x))
        out["F"] = self.farm.objectives(t)
        out["G"] = list(self.farm.violations(t))


def optimise(farm, pop=80, gens=120, seed=1):
    """Pareto plans, then one per goal: most profit, safest bad year, least soil loss, most carbon (least water)."""
    prob = FarmProblem(farm)
    F = len(farm.fields)
    rng = np.random.default_rng(seed)
    L = prob.xu[-1] + 1
    starts = [[i] * F + [f % L for f in range(F)] for i in range(len(farm.allowed))]  # whole farm on one rotation, staggered
    starts = [starts[i] for i in rng.permutation(len(starts))[:pop // 2]]
    X0 = np.array(starts + rng.integers(0, np.array(prob.xu) + 1, size=(pop - len(starts), 2 * F)).tolist())
    alg = NSGA2(pop_size=pop, sampling=X0, crossover=SBX(prob=0.9, eta=3, vtype=float, repair=RoundingRepair()),
                mutation=PM(prob=0.3, eta=3, vtype=float, repair=RoundingRepair()), eliminate_duplicates=True)
    res = minimize(prob, alg, ("n_gen", gens), seed=seed, verbose=False)
    P = res.pop
    cv, Fv, X = P.get("CV").ravel(), P.get("F"), P.get("X")
    ok = cv <= 0
    if not ok.any():  # nothing fits the machinery and contracts: show the closest plan and by how much it misses
        return [farm.report(farm.pick(X[int(np.argmin(cv))]), "closest")]
    Fv, X = Fv[ok], X[ok]
    goals = ["profit", "safe", "soil", "carbon"] + (["water"] if farm.irrigated else [])
    span = np.ptp(Fv, axis=0) + 1e-9
    picks = [("balanced", int(np.argmin((((Fv - Fv.min(axis=0)) / span) ** 2).sum(axis=1))))]
    picks += [(g, int(np.argmin(Fv[:, i]))) for i, g in enumerate(goals)]
    out, seen = [], {}
    for key, i in picks:
        plan = farm.pick(X[i])
        k = json.dumps(plan)
        if k in seen:
            seen[k]["also"].append(key)
            continue
        rep = dict(farm.report(plan, key), also=[])
        seen[k] = rep
        out.append(rep)
    return out


def plan_farm(rid, fields, machinery, exclude=(), contracts=()):
    """fields: [{name, ring, soil, key, power, lat}] (key: POWER grid box) -> dict for the web app."""
    wx = {}
    for f in fields:
        if f["key"] not in wx:  # fields in one POWER box share the weather
            wx[f["key"]] = Weather(f["power"], f["lat"]), Weather(f["power"], f["lat"], 2, -0.1)
        f.update(area=area_ha(f["ring"]), wx=wx[f["key"]][0], wx_stress=wx[f["key"]][1])
    farm = Farm(rid, fields, machinery["seed_ha_day"], machinery["harvest_ha_day"], machinery.get("notill", False),
                machinery.get("drip", False), exclude, contracts)
    return dict(
        template=rid, area=round(float(farm.area.sum())), years=[farm.years[0], farm.years[-1]], work_days=WORK_DAYS,
        machinery=machinery, exclude=list(exclude),
        fields=[dict(name=f["name"], ring=f["ring"], area=round(f["area"], 1), soil={k: round(v, 2) for k, v in f["soil"].items()}) for f in fields],
        crops={k: dict(label=v["label"], label_ru=v["label_ru"], price=v["price"], cost=v["cost"], family=v["family"]) for k, v in CROPS[rid].items()},
        baseline=farm.report(farm.baseline(), "current"),
        plans=optimise(farm),
        options=len(farm.allowed),
    )
