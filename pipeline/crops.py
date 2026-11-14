"""Crop parameters, prices and the strategies. Every number here is an ASSUMPTION for the demo,
order of magnitude from FAO-56 / FAO-33 tables and public price ranges; an agronomist replaces them.

Season: sow = day of year, days = length. kc = (ini, mid, end) FAO-56 style. ky = FAO-33 yield response.
ymax = attainable yield t/ha in the region with no water stress. heat = Tmax (C) above which flowering suffers.
res = residue cover fraction left at harvest (no-till). cin = t C/ha returned per t of yield (straw + roots).
cbase = t C/ha returned regardless of yield (roots, stubble). fix = legume (N credit to the next crop).
price $/t, cost $/ha (seed, fert, fuel, ops; not land or water).
"""

C = lambda **k: k  # noqa: E731

CROPS = {
    "vko": {
        "wheat":    C(label="Spring wheat", label_ru="Яровая пшеница", sow=135, days=105, kc=(0.3, 1.15, 0.3), ky=1.15, ymax=3.2, heat=33, res=0.75, cin=1.1, cbase=0.4, price=190, cost=190, family="cereal"),
        "fallow":   C(label="Black fallow", label_ru="Чёрный пар", sow=135, days=110, kc=(0, 0, 0), ky=0, ymax=0, heat=99, res=0.0, cin=0, cbase=0, price=0, cost=45, family="fallow", tillage_passes=3),
        "lentil":   C(label="Lentil", label_ru="Чечевица", sow=140, days=90, kc=(0.4, 1.05, 0.3), ky=1.1, ymax=1.8, heat=32, res=0.30, cin=0.9, cbase=0.3, price=430, cost=210, family="pulse", fix=True),
        "pea":      C(label="Field pea", label_ru="Горох", sow=130, days=90, kc=(0.4, 1.10, 0.3), ky=1.1, ymax=2.4, heat=30, res=0.35, cin=0.8, cbase=0.3, price=230, cost=200, family="pulse", fix=True),
        "flax":     C(label="Oilseed flax", label_ru="Лён масличный", sow=140, days=105, kc=(0.35, 1.05, 0.25), ky=1.0, ymax=1.6, heat=32, res=0.55, cin=1.2, cbase=0.3, price=420, cost=190, family="oilseed"),
        "rapeseed": C(label="Spring rapeseed", label_ru="Яровой рапс", sow=135, days=110, kc=(0.35, 1.10, 0.35), ky=1.05, ymax=1.9, heat=30, res=0.45, cin=1.3, cbase=0.35, price=440, cost=240, family="oilseed"),
        "sainfoin": C(label="Sainfoin (hay)", label_ru="Эспарцет (сено)", sow=120, days=140, kc=(0.5, 1.0, 0.9), ky=0.9, ymax=4.0, heat=36, res=0.85, cin=0.35, cbase=1.2, price=70, cost=110, family="forage", fix=True, perennial=True),
        "chickpea": C(label="Chickpea", label_ru="Нут", sow=140, days=100, kc=(0.4, 1.0, 0.35), ky=0.85, ymax=1.9, heat=35, res=0.30, cin=0.9, cbase=0.3, price=460, cost=210, family="pulse", fix=True),
        "millet":   C(label="Proso millet", label_ru="Просо", sow=155, days=85, kc=(0.3, 1.0, 0.3), ky=0.9, ymax=2.4, heat=38, res=0.60, cin=1.0, cbase=0.35, price=180, cost=150, family="cereal"),
    },
    "az": {
        "cotton":   C(label="Upland cotton (lint + seed)", label_ru="Хлопчатник (волокно + семена)", sow=105, days=180, kc=(0.35, 1.15, 0.6), ky=0.85, ymax=2.0, heat=46, res=0.20, cin=2.0, cbase=0.5, price=1750, cost=1600, family="fibre"),
        "durum":    C(label="Durum wheat", label_ru="Твёрдая пшеница", sow=345, days=160, kc=(0.3, 1.15, 0.3), ky=1.15, ymax=7.0, heat=35, res=0.70, cin=0.45, cbase=0.5, price=300, cost=1050, family="cereal"),
        "fallow":   C(label="Summer fallow", label_ru="Летний пар", sow=160, days=150, kc=(0, 0, 0), ky=0, ymax=0, heat=99, res=0.0, cin=0, cbase=0, price=0, cost=60, family="fallow", tillage_passes=2),
        "guar":     C(label="Guar", label_ru="Гуар", sow=180, days=110, kc=(0.35, 1.0, 0.4), ky=0.9, ymax=2.0, heat=46, res=0.30, cin=0.9, cbase=0.35, price=650, cost=600, family="pulse", fix=True),
        "sorghum":  C(label="Grain sorghum", label_ru="Зерновое сорго", sow=185, days=115, kc=(0.3, 1.0, 0.55), ky=0.9, ymax=7.5, heat=42, res=0.60, cin=0.45, cbase=0.5, price=210, cost=850, family="cereal"),
        "cover":    C(label="Cowpea cover (no harvest)", label_ru="Вигна, покровная (без урожая)", sow=175, days=80, kc=(0.4, 0.95, 0.8), ky=0, ymax=0, heat=46, res=0.80, cin=0, cbase=1.4, price=0, cost=160, family="cover", fix=True),
        "barley":   C(label="Barley", label_ru="Ячмень", sow=340, days=150, kc=(0.3, 1.15, 0.25), ky=1.0, ymax=6.0, heat=35, res=0.70, cin=0.45, cbase=0.5, price=230, cost=850, family="cereal"),
    },
}

# Strategies: hypotheses to discuss with an agronomist, not recommendations.
STRATEGIES = {
    "vko": [
        dict(id="current", name="Current: wheat, wheat, black fallow", name_ru="Сейчас: пшеница, пшеница, чёрный пар", rotation=["wheat", "wheat", "fallow"], notill=False,
             why="What most farms in the region do now: the baseline.", why_ru="Так сейчас работает большинство хозяйств региона: база для сравнения.",
             idea="Fallow stores a year of moisture for the next wheat.", idea_ru="Пар копит влагу года для следующей пшеницы.",
             risk="Soil lies bare 20+ months per cycle: wind erosion and humus loss.",
             risk_ru="Почва голая 20+ месяцев за цикл: ветровая эрозия и потеря гумуса."),
        dict(id="A", name="A. Diversify: wheat, lentil, flax, wheat", name_ru="A. Разнообразие: пшеница, чечевица, лён, пшеница", rotation=["wheat", "lentil", "flax", "wheat"], notill=True,
             why="Wheat after wheat loses yield to root rot; the region already sells lentil and flax for export.", why_ru="Пшеница по пшенице теряет урожай от корневых гнилей; регион уже продаёт чечевицу и лён на экспорт.",
             idea="No fallow, no-till. Lentil fixes nitrogen, breaks cereal disease, adds export crops.", idea_ru="Без пара, no-till. Чечевица даёт азот, рвёт цикл болезней зерновых, добавляет экспортные культуры.",
             risk="No stored moisture: watch the dry years in the time machine.",
             risk_ru="Нет запаса влаги: смотрите сухие годы в машине времени."),
        dict(id="B", name="B. Soil and forage: sainfoin 2 yrs in the cycle", name_ru="B. Почва и корма: эспарцет 2 года в цикле", rotation=["wheat", "pea", "sainfoin", "sainfoin", "wheat"], notill=True,
             why="Wind is the main way these fields lose soil; a perennial holds it all year.", why_ru="Главная потеря почвы здесь — от ветра; многолетник держит её круглый год.",
             idea="Perennial cover builds organic matter and stops wind.", idea_ru="Многолетний покров копит органику и держит ветер.",
             risk="Hay needs livestock or a buyer nearby.",
             risk_ru="Сену нужен скот или покупатель рядом."),
        dict(id="C", name="C. Drought-tolerant: wheat, chickpea, millet", name_ru="C. Засухоустойчивая: пшеница, нут, просо", rotation=["wheat", "chickpea", "millet"], notill=True,
             why="Hot, dry Julys recur in the weather record; chickpea and millet stand heat better than wheat.", why_ru="Жаркий сухой июль повторяется в погодном ряду; нут и просо переносят жару лучше пшеницы.",
             idea="Crops that tolerate heat and use less water.", idea_ru="Культуры, которые терпят жару и пьют меньше воды.",
             risk="Thin markets for chickpea and millet in the region.",
             risk_ru="Мало покупателей нута и проса в регионе."),
    ],
    "az": [
        dict(id="current", name="Current: cotton, durum, summer fallow", name_ru="Сейчас: хлопок, твёрдая пшеница, летний пар", rotation=["cotton", "durum", "fallow"], notill=False, irrigation="flood",
             why="The common Pinal County pattern: the baseline.", why_ru="Обычная схема округа Пинал: база для сравнения.",
             idea="Two cash crops on groundwater and canal water.", idea_ru="Две товарные культуры на подземной и канальной воде.",
             risk="Bare fields through the monsoon dust season; heavy pumping.",
             risk_ru="Голые поля в пыльный сезон муссона; много откачки."),
        dict(id="A", name="A. Water-wise: durum, guar on drip", name_ru="A. Экономия воды: твёрдая пшеница, гуар на капельном", rotation=["durum", "guar"], notill=True, irrigation="drip",
             why="Pinal farms have lost most of their Colorado River water since 2023; every pumped millimetre counts.", why_ru="С 2023 года хозяйства Пинала лишились большей части воды из Колорадо; каждый откачанный миллиметр на счету.",
             idea="Winter grain uses cool-season rain; guar is a low-water summer legume.", idea_ru="Озимое зерно берёт зимние дожди; гуар — маловодная летняя бобовая.",
             risk="Drip costs money up front; guar has one main buyer chain.",
             risk_ru="Капельный полив стоит денег сразу; у гуара одна цепочка сбыта."),
        dict(id="B", name="B. Cover the summer: cotton, durum, cowpea cover", name_ru="B. Покрыть лето: хлопок, пшеница, вигна", rotation=["cotton", "durum", "cover"], notill=True, irrigation="flood",
             why="Bare summer fallow feeds monsoon dust storms; a cover holds the soil.", why_ru="Голый летний пар питает пыльные бури муссона; покровная культура держит почву.",
             idea="Keeps the cotton income, covers soil in dust season, feeds soil carbon.", idea_ru="Сохраняет доход от хлопка, укрывает почву в пыльный сезон, кормит почвенный углерод.",
             risk="A summer cover in the desert drinks water that earns no direct income.",
             risk_ru="Покровная культура летом в пустыне пьёт воду без прямого дохода."),
        dict(id="C", name="C. Winter-only grain, summers fallow under stubble", name_ru="C. Только озимое зерно, летом пар под стернёй", rotation=["barley", "durum"], notill=True, irrigation="drip",
             why="If water is the hard limit, the hottest season is the one to skip.", why_ru="Если вода — жёсткий предел, пропускать стоит самый жаркий сезон.",
             idea="Farm only the cool season, leave summer water in the aquifer.", idea_ru="Работать только в прохладный сезон, летнюю воду оставить в водоносном слое.",
             risk="Lowest income; works only with water-saving payments.",
             risk_ru="Самый низкий доход; работает только с выплатами за экономию воды."),
    ],
}

# Farmer priorities: nitrogen and market. Same status as above: assumptions an agronomist replaces.
# N_RATE: mineral N, kg/ha, a crop needs at the attainable yield; a legume before it saves N_CREDIT.
N_RATE = {
    "vko": dict(wheat=50, fallow=0, lentil=0, pea=0, flax=30, rapeseed=70, sainfoin=0, chickpea=0, millet=30),
    "az": dict(cotton=170, durum=250, fallow=0, guar=20, sorghum=150, cover=0, barley=180),
}
N_CREDIT = 30
# MARKET: "deep" = several buyers or an export channel in reach; "thin" = one buyer chain or local demand only.
MARKET = {
    "vko": dict(wheat="deep", lentil="deep", pea="deep", flax="deep", rapeseed="deep", sainfoin="thin", chickpea="thin", millet="thin"),
    "az": dict(cotton="deep", durum="deep", guar="thin", sorghum="deep", barley="deep"),
}

IRRIGATION = {"flood": 0.70, "drip": 0.90}  # application efficiency
PUMP_COST = 0.05          # $/m3 pumping + delivery, ~$60 per acre-foot (assumption)
CO2_PRICE = (15, 35)      # $/t CO2e voluntary soil-carbon range (assumption)
