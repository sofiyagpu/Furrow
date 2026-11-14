# Pitch and video script (2 minutes)

**0:00 The problem.** In East Kazakhstan, in a wheat-wheat-fallow rotation, a field lies bare as black fallow
every third summer to save a year of rain. In Pinal County, Arizona, fields sit bare through the dust season while wells pump
the aquifer that GRACE-FO shows draining. Farmers know the alternatives exist. They don't know what each
would have done on *their* field in *their* weather.

**0:20 Furrow.** Pick a field on the map. NASA layers sit underneath: MODIS NDVI, SMAP soil moisture, IMERG rain,
GRACE-FO water storage. Each cell carries SoilGrids soil and 22 years of NASA POWER weather.

**0:40 Four strategies.** Current practice against three alternatives, each written as a hypothesis for an
agronomist. Profit is a range, from a 1-in-10 bad year to a 1-in-10 good one. Never a promise.

**1:00 Time machine.** Slide to the worst drought year. Watch diversification without fallow run short of water,
and see by how much. That is the risk the farmer is right to fear, made visible.

**1:15 Climate twin.** Two degrees warmer, ten percent less rain: which rotation still pays?

**1:30 Trade-off cockpit.** NSGA-II searched hundreds of rotations. Set the most soil you are willing to lose and
the worst year you can survive. The list keeps only what fits. The farmer picks.

**1:45 Bonus.** Soil carbon from RothC turned into a credit range, with the verification caveat. In Arizona,
groundwater left in the aquifer per farm, in acre-feet.

**1:55 Close.** Furrow does not tell a farmer what to plant. It shows what each choice would have cost and kept.
Built on NASA data, open source.

## Strategy cards for the agronomist

Per region in `pipeline/crops.py`, `STRATEGIES`. Each has: the rotation, tillage, irrigation, one-line idea,
one-line risk. Questions to put to the agronomist before the demo:

- VKO: is lentil after wheat realistic north of Ust-Kamenogorsk, or is pea safer? Sainfoin or sweet clover?
- VKO: which buyers take chickpea and millet within 300 km?
- AZ: guar contract availability in Pinal; drip conversion cost per hectare; summer cover water allocation.
- Both: replace the prices and costs in `CROPS` with this year's local numbers.
