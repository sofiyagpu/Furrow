"""Field simulator: daily soil water balance + yield (FAO-56 / FAO-33, AquaCrop-style water productivity
logic kept to one bucket), wind erosion (RWEQ-style index), water erosion (RUSLE), soil carbon (RothC-26.3).

ponytail: one 1.2 m soil bucket and fixed slope (no DEM); swap in AquaCrop-OSPy / a DEM when the 30 m
pipeline is wired. Outputs are for comparing strategies on the same field, not absolute forecasts.
"""
import math
from datetime import date, timedelta
import numpy as np

from crops import CROPS, IRRIGATION, PUMP_COST

ROOT_MM = 1200  # bucket depth


# ---------- weather ----------
class Weather:
    def __init__(self, power, lat, dT=0.0, dP=0.0):
        d = [date(int(s[:4]), int(s[4:6]), int(s[6:])) for s in power["dates"]]
        clean = lambda k: np.where(np.array(power[k], float) < -900, np.nan, np.array(power[k], float))  # noqa: E731
        tx, tn = clean("T2M_MAX") + dT, clean("T2M_MIN") + dT
        p = np.nan_to_num(clean("PRECTOTCORR")) * (1 + dP)
        wind = clean("WS2M")
        for a in (tx, tn, wind):  # fill rare gaps with the previous day
            for i in np.where(np.isnan(a))[0]:
                a[i] = a[i - 1]
        self.dates, self.tx, self.tn, self.p, self.wind = d, tx, tn, p, wind
        self.doy = np.array([x.timetuple().tm_yday for x in d])
        self.year = np.array([x.year for x in d])
        self.month = np.array([x.month for x in d])
        self.et0 = hargreaves(tx, tn, self.doy, lat)
        self.n = len(d)


def hargreaves(tx, tn, doy, lat):
    """FAO-56 eq. 52 with extraterrestrial radiation Ra (eq. 21)."""
    phi = math.radians(lat)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    ra = 24 * 60 / np.pi * 0.082 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))
    tm = (tx + tn) / 2
    return np.maximum(0, 0.0023 * 0.408 * ra * (tm + 17.8) * np.sqrt(np.maximum(tx - tn, 0)))


# ---------- soil ----------
def soil_hydraulics(clay, sand, soc):
    """Saxton & Rawls (2006) wilting point and field capacity, volumetric."""
    S, Cl, OM = sand / 100, clay / 100, min(soc * 1.724 / 10, 8)
    t1500 = -0.024 * S + 0.487 * Cl + 0.006 * OM + 0.005 * S * OM - 0.013 * Cl * OM + 0.068 * S * Cl + 0.031
    wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * S + 0.195 * Cl + 0.011 * OM + 0.006 * S * OM - 0.027 * Cl * OM + 0.452 * S * Cl + 0.299
    fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015)
    return wp, fc


def wind_erodibility(clay, sand, soc):
    """RWEQ erodible fraction (Fryrear 1998), CaCO3 ignored."""
    silt = max(0, 100 - clay - sand)
    om = soc * 1.724 / 10
    ef = (29.09 + 0.31 * sand + 0.17 * silt + 0.33 * sand / max(clay, 1) - 2.59 * om) / 100
    return float(np.clip(ef, 0.05, 0.9))


def usle_k(clay, sand, soc):
    """EPIC K factor (Williams 1995), t h / (MJ mm)."""
    silt = max(0, 100 - clay - sand)
    c = soc / 10
    sn = 1 - sand / 100
    k = ((0.2 + 0.3 * math.exp(-0.0256 * sand * (1 - silt / 100))) * (silt / max(clay + silt, 1)) ** 0.3
         * (1 - 0.25 * c / (c + math.exp(3.72 - 2.95 * c))) * (1 - 0.7 * sn / (sn + math.exp(-5.51 + 22.9 * sn))))
    return 0.1317 * k


# ---------- schedule ----------
def schedule(rotation, wx, region, phase=0):
    """Lay the rotation onto the calendar starting at slot `phase`. Returns [(slot_idx, crop, start, end)]."""
    crops, seasons, t, i = CROPS[region], [], 0, phase
    while True:
        name = rotation[i % len(rotation)]
        c = crops[name]
        s = t
        while s < wx.n and wx.doy[s] != c["sow"]:
            s += 1
        e = s + c["days"]
        if e >= wx.n:
            return seasons
        seasons.append((i, name, s, e))
        t, i = e + 1, i + 1


def kc_curve(c, f):
    ini, mid, end = c["kc"]
    if f < 0.2:
        return ini
    if f < 0.45:
        return ini + (mid - ini) * (f - 0.2) / 0.25
    if f < 0.8:
        return mid
    return mid + (end - mid) * (f - 0.8) / 0.2


# ---------- RothC ----------
RK = dict(dpm=10.0, rpm=0.3, bio=0.66, hum=0.02)


def rothc_init(soc_t):
    iom = 0.049 * soc_t ** 1.139  # Falloon et al. 1998
    act = soc_t - iom
    return dict(dpm=0.01 * act, rpm=0.12 * act, bio=0.025 * act, hum=0.845 * act, iom=iom)


def rothc_month(pools, temp, tsmd, tsmd_max, covered, c_in, dpm_rpm, clay):
    a = 47.91 / (1 + math.exp(106.06 / (temp + 18.27))) if temp > -13 else 0  # ~0 below -13 C
    b = 1.0 if tsmd > 0.444 * tsmd_max else 0.2 + 0.8 * (tsmd_max - tsmd) / (tsmd_max - 0.444 * tsmd_max)
    cf = 0.6 if covered else 1.0
    pools["dpm"] += c_in * dpm_rpm / (1 + dpm_rpm)
    pools["rpm"] += c_in / (1 + dpm_rpm)
    x = 1.67 * (1.85 + 1.60 * math.exp(-0.0786 * clay))
    to_bio, to_hum = 0.46 / (x + 1), 0.54 / (x + 1)
    out = 0.0
    for k in ("dpm", "rpm", "bio", "hum"):
        d = pools[k] * (1 - math.exp(-a * b * cf * RK[k] / 12))
        pools[k] -= d
        out += d
    pools["bio"] += out * to_bio
    pools["hum"] += out * to_hum
    return sum(pools.values())


# ---------- the simulation ----------
def simulate(rotation, wx, soil, region, notill=False, irrigation=None, phase=0, irr_cap=None, dekads=False):
    """Run the rotation over the whole weather record.

    Returns dict: seasons (per crop), years (per calendar year), optional dekad series.
    irr_cap: max gross irrigation mm/yr (water allocation); None = unlimited.
    """
    crops = CROPS[region]
    wp, fc = soil_hydraulics(soil["clay"], soil["sand"], soil["soc"])
    taw = max(fc - wp, 0.05) * ROOT_MM
    sw = 0.5 * taw  # plant-available water in the bucket, mm
    snow, residue, since_rain = 0.0, 0.3, 0
    ef = wind_erodibility(soil["clay"], soil["sand"], soil["soc"])
    k_usle = usle_k(soil["clay"], soil["sand"], soil["soc"])
    soc0 = soil["soc"] * soil["bdod"] * 30 * 0.1  # t C/ha in 0-30 cm
    pools = rothc_init(soc0)
    tsmd_max = -(20 + 1.3 * soil["clay"] - 0.01 * soil["clay"] ** 2) * (30 / 23)
    tsmd = 0.0
    eff = IRRIGATION.get(irrigation, 1)

    seasons = schedule(rotation, wx, region, phase)
    day_crop = np.full(wx.n, -1)
    for j, (_, _, s, e) in enumerate(seasons):
        day_crop[s:e] = j
    if not seasons:
        return None
    first, last = seasons[0][2], seasons[-1][3]
    # a perennial stand stays alive between its own consecutive seasons
    per_day = np.zeros(wx.n, bool)
    for j, (_, name, s, e) in enumerate(seasons):
        if crops[name].get("perennial"):
            nxt = seasons[j + 1] if j + 1 < len(seasons) else None
            per_day[s:(nxt[2] if nxt and nxt[1] == name else e)] = True

    st = [dict(etc=0.0, eta=0.0, irr=0.0, heat=0) for _ in seasons]
    yr = {}
    mon = dict(t=0.0, n=0, p=0.0, et=0.0, cov=0, cin=0.0)
    dek = [] if dekads else None
    dacc = dict(sw=0.0, cov=0.0, n=0)

    for t in range(first, last):
        y = wx.year[t]
        Y = yr.setdefault(y, dict(irr=0.0, wind=0.0, rain_r=0.0, cover_days=0, bare_days=0, cin=0.0, et=0.0, drain=0.0))
        j = day_crop[t]
        tm = (wx.tx[t] + wx.tn[t]) / 2
        et0 = wx.et0[t]
        crop = crops[seasons[j][1]] if j >= 0 else None
        prev_same = j > 0 and seasons[j - 1][1] == seasons[j][1]
        perennial_on = per_day[t]

        # precipitation, snow
        p = wx.p[t]
        if tm < 0:
            catch = 0.9 if perennial_on else (0.85 if notill and residue > 0.3 else 0.6)  # stubble traps snow
            snow += p * catch
            rain = 0.0
        else:
            rain = p
        melt = min(snow, 3.0 * max(tm, 0))
        snow -= melt
        water_in = rain + melt * (0.85 if notill else 0.7)  # melt over frozen bare soil runs off
        if rain > 15:
            water_in -= (0.15 if residue > 0.3 or crop else 0.3) * (rain - 15)

        # crop water use
        cover = 0.0
        if crop and crop["ymax"] + crop["cbase"] > 0 and crop["kc"][1] > 0:
            f = (t - seasons[j][2]) / crop["days"]
            if crop.get("perennial") and prev_same:
                f = max(f, 0.3)  # established stand starts green
            kc = kc_curve(crop, f)
            cover = max(0.0, min(1.0, (kc - 0.15) / (crop["kc"][1] - 0.15)))
            p_dep = 0.55
            ks = 1.0 if sw > (1 - p_dep) * taw else sw / ((1 - p_dep) * taw)
            etc = kc * et0
            # irrigation: refill when stressed
            if irrigation and sw < (1 - p_dep) * taw:
                need = taw * 0.9 - sw
                gross = need / eff
                if irr_cap is not None:
                    gross = min(gross, max(0.0, irr_cap - Y["irr"]))
                Y["irr"] += gross
                st[j]["irr"] += gross
                sw += gross * eff
                ks = 1.0 if sw > (1 - p_dep) * taw else sw / ((1 - p_dep) * taw)
            eta = etc * ks
            st[j]["etc"] += etc
            st[j]["eta"] += eta
            if 0.55 < f < 0.75 and wx.tx[t] > crop["heat"]:
                st[j]["heat"] += 1
        else:
            eta = 0.0
        if perennial_on and not crop:
            cover = 0.5 if tm > 0 else 0.7  # dormant stand
        # soil evaporation from the exposed fraction; residue mulch halves it
        ke = (1 - cover) * (0.5 if residue > 0.3 else 1.0) * 0.9
        evap = ke * et0 * (sw / taw) ** 2 if snow < 5 else 0
        sw += water_in - eta - evap
        Y["et"] += eta + evap
        if sw > taw:
            Y["drain"] += sw - taw
            sw = taw
        sw = max(sw, 0.0)

        # residue: decays, buried by tillage
        residue *= 1 - 0.006 * max(tm, 0) / 20  # decomposition stops in the cold
        if crop and t == seasons[j][2] and not (crop.get("perennial") and prev_same):
            residue *= 0.9 if notill else 0.4  # sowing pass
        if crop and crop.get("tillage_passes") and (t - seasons[j][2]) % max(1, crop["days"] // crop["tillage_passes"]) == 0:
            residue *= 0.3  # fallow cultivation (black fallow is tilled to kill weeds)
        protected = max(cover, residue * 0.9, 0.95 if snow > 10 else 0)
        bare = 1 - min(protected, 1)
        if bare > 0.7:
            Y["bare_days"] += 1
        else:
            Y["cover_days"] += 1

        # wind erosion index (RWEQ-style): cube of the excess of gusts over threshold on dry, bare soil
        u = wx.wind[t] * 1.9  # daily mean -> gust
        if u > 5 and rain < 1:
            dry = min(1.0, since_rain / 3)  # the top few mm dry out in ~3 days whatever the subsoil holds
            rough = 0.6 if notill else 1.0  # tilled surface: broken aggregates, no crust
            Y["wind"] += 0.02 * (u - 5) ** 3 * ef * bare * dry * rough  # t/ha (indicative)
        since_rain = 0 if rain + melt > 2 else since_rain + 1
        Y["rain_r"] += rain

        # harvest
        if j >= 0 and t == seasons[j][3] - 1:
            res = residue_after(crop, notill)
            residue = max(residue, res)

        # RothC monthly step
        mon["t"] += tm
        mon["n"] += 1
        mon["p"] += rain + melt
        mon["et"] += et0
        mon["cov"] += 1 if (cover > 0.3 or perennial_on) else 0
        if t + 1 >= last or wx.month[t + 1] != wx.month[t]:
            tsmd = min(0.0, max(tsmd_max * (1 if mon["cov"] > mon["n"] / 2 else 1 / 1.8), tsmd + mon["p"] - mon["et"]))
            Y["soc"] = rothc_month(pools, mon["t"] / mon["n"], tsmd, tsmd_max, mon["cov"] > mon["n"] / 2,
                                   mon["cin"], 0.67 if perennial_on else 1.44, soil["clay"])
            mon = dict(t=0.0, n=0, p=0.0, et=0.0, cov=0, cin=0.0)

        # harvest bookkeeping and C input go into next month's pool update
        if j >= 0 and t == seasons[j][3] - 1:
            s = st[j]
            prev = seasons[j - 1][1] if j > 0 else None
            s.update(_season_result(crop, s, prev, crops, prev_same, irrigation, region))
            mon["cin"] += s["c_in"]
            Y["cin"] += s["c_in"]

        if dekads:
            dacc["sw"] += sw
            dacc["cov"] += 1 - bare
            dacc["n"] += 1
            d = wx.dates[t]
            if d.day in (10, 20) or (d + timedelta(days=1)).day == 1:
                dek.append((d.isoformat(), round(dacc["sw"] / dacc["n"]), round(dacc["cov"] / dacc["n"], 2),
                            seasons[j][1] if j >= 0 else ""))
                dacc = dict(sw=0.0, cov=0.0, n=0)

    # RUSLE per year: R from annual rain (Renard & Freimund 1994), LS fixed for gentle 2% x 100 m slope
    for y, Y in yr.items():
        R = 0.0483 * Y["rain_r"] ** 1.61
        cfac = 0.05 + 0.45 * Y["bare_days"] / max(1, Y["bare_days"] + Y["cover_days"])
        Y["water"] = R * k_usle * 0.3 * cfac

    out_seasons = []
    for (i, name, s, e), r in zip(seasons, st):
        if "yield" not in r:
            continue
        out_seasons.append(dict(crop=name, slot=i, start=wx.dates[s].isoformat(), harvest=wx.dates[e - 1].isoformat(),
                                year=int(wx.year[e - 1]), **{k: round(v, 3) for k, v in r.items()}))
    return dict(seasons=out_seasons, years=yr, soc0=soc0, taw=taw, dekads=dek)


def residue_after(crop, notill):
    return crop["res"] * (1 if notill else 0.8)


def _season_result(crop, s, prev, crops, prev_same, irrigation, region):
    if crop["ymax"] == 0:
        y = 0.0
    else:
        rel = s["eta"] / s["etc"] if s["etc"] else 0
        y = crop["ymax"] * max(0.0, 1 - crop["ky"] * (1 - rel))
        y *= max(0.5, 1 - 0.04 * s["heat"])
        if prev and crops[prev].get("fix"):
            y *= 1.10  # nitrogen and rotation credit after a legume
        if prev == "fallow":
            y *= 1.05  # fallow also mineralises N
        same_family = prev and crops[prev]["family"] == crop["family"] and crop["family"] != "forage"
        if prev and crops[prev] is crop and not crop.get("perennial"):
            y *= 0.85  # same crop again: its own diseases and weeds build up
        elif same_family:
            y *= 0.92 if crop["family"] == "cereal" else 0.88  # cereal root rots; pulse ascochyta, oilseed sclerotinia
        if crop.get("perennial") and not prev_same:
            y *= 0.35  # establishment year
    cost = crop["cost"] * (0.5 if crop.get("perennial") and prev_same else 1)
    water_cost = s["irr"] * 10 * PUMP_COST if irrigation else 0
    revenue = y * crop["price"]
    c_in = crop["cbase"] + crop["cin"] * y
    return dict(**{"yield": y}, revenue=revenue, cost=cost + water_cost, profit=revenue - cost - water_cost, c_in=c_in)


# ---------- summaries ----------
def run_strategy(strategy, wx, soil, region, irr_cap=None, dekads=False):
    """Every rotation phase over the whole record. Annual numbers per (phase, year)."""
    rot = strategy["rotation"]
    rows, seasons_all, dek, soc = [], [], None, []
    for ph in range(len(rot)):
        r = simulate(rot, wx, soil, region, strategy.get("notill", False), strategy.get("irrigation"), ph, irr_cap,
                     dekads=dekads and ph == 0)
        if r is None:
            continue
        if ph == 0:
            dek, seasons_all = r["dekads"], r["seasons"]
        prof = {}
        for s in r["seasons"]:
            prof[s["year"]] = prof.get(s["year"], 0) + s["profit"]
        ys = sorted(r["years"])[1:-1]  # drop partial first/last years
        for y in ys:
            Y = r["years"][y]
            rows.append(dict(phase=ph, year=y, profit=prof.get(y, 0.0), wind=Y["wind"],
                             water=Y["water"], irr=Y["irr"], bare=Y["bare_days"], soc=Y.get("soc", r["soc0"]),
                             drain=Y["drain"]))
        soc.append((r["years"][ys[-1]].get("soc", r["soc0"]) - r["years"][ys[0]].get("soc", r["soc0"])) / max(1, len(ys) - 1))
    return rows, seasons_all, dek, float(np.mean(soc)), r["soc0"]


def summarise(rows, dsoc):
    a = lambda k: np.array([r[k] for r in rows])  # noqa: E731
    profit = a("profit")
    pct = lambda x: [round(float(v), 1) for v in np.percentile(x, [10, 50, 90])]  # noqa: E731
    return dict(
        profit=pct(profit), profit_mean=round(float(profit.mean()), 1),
        loss_years=round(float((profit < 0).mean()), 2),
        wind=pct(a("wind")), water=pct(a("water")), erosion=round(float((a("wind") + a("water")).mean()), 2),
        irr=pct(a("irr")), bare_days=round(float(a("bare").mean())),
        dsoc=round(dsoc, 3),
    )


if __name__ == "__main__":
    # self-check on synthetic weather: physics sanity, not calibration
    n = 365 * 6
    d0 = date(2001, 1, 1)
    days = [d0 + timedelta(days=i) for i in range(n)]
    doy = np.array([x.timetuple().tm_yday for x in days])
    tmean = 3 + 18 * np.sin(2 * np.pi * (doy - 110) / 365)
    rng = np.random.default_rng(0)
    power = {"dates": [x.strftime("%Y%m%d") for x in days], "T2M_MAX": list(tmean + 6), "T2M_MIN": list(tmean - 6),
             "PRECTOTCORR": list(rng.exponential(1.0, n)), "WS2M": list(3 + rng.random(n) * 3)}
    wx = Weather(power, 50.5)
    soil = dict(clay=25, sand=35, soc=25, bdod=1.25)
    c = run_strategy(dict(rotation=["wheat", "wheat", "fallow"]), wx, soil, "vko")
    cur = summarise(c[0], c[3])
    perm = run_strategy(dict(rotation=["sainfoin", "sainfoin", "wheat"], notill=True), wx, soil, "vko")
    perm_s = summarise(perm[0], perm[3])
    assert cur["bare_days"] > perm_s["bare_days"], (cur, perm_s)
    assert perm_s["dsoc"] > cur["dsoc"], (cur, perm_s)
    assert cur["wind"][1] >= perm_s["wind"][1]
    print("ok", cur, perm_s, sep="\n")
