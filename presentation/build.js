// Furrow pitch deck. node build.js -> build/furrow.pptx; then animate.py writes the theme, transitions and animations
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const B = (f) => path.join(__dirname, "build", f);
const D = JSON.parse(fs.readFileSync(path.join(__dirname, "deck_data.json"), "utf8"));
const V = D.vko, AZ = D.az;
const S = (r, id) => r.strategies.find((s) => s.id === id);

const THEME = {
  name: "Furrow Starfield",
  headFontFace: "Libre Franklin ExtraBold",
  bodyFontFace: "Libre Franklin",
  colors: {
    dk1: "05060B", lt1: "FFFFFF", dk2: "0E1322", lt2: "AEB6C8",
    accent1: "FFE81F", accent2: "4BD5EE", accent3: "2A78D6", accent4: "EB6834", accent5: "1BAF7A", accent6: "EDA100",
    hlink: "4BD5EE", folHlink: "AEB6C8",
  },
};
const HEX = { yellow: "FFE81F", holo: "4BD5EE", red: "E5484D", muted: "AEB6C8", grid: "1E2438", line: "28304A",
  cur: "2A78D6", A: "EB6834", B: "1BAF7A", C: "EDA100" };
const SC = [HEX.cur, HEX.A, HEX.B, HEX.C];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Furrow: crop rotation planner on NASA data";
pres.subject = "NASA Space Apps 2026, Adapting farms with NASA data";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

const M = 0.6, CW = 13.333 - 2 * M, TOP = 1.95;
const num = { x: 12.13, y: 6.98, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: "right" };

pres.defineSlideMaster({ title: "Starfield blank", background: { path: B("stars.png") } });
pres.defineSlideMaster({
  title: "Starfield title only",
  background: { path: B("stars.png") },
  slideNumber: num,
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.42, w: CW, h: 0.36, fontSize: 13, bold: true,
      color: C.accent2, charSpacing: 4, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.8, w: CW, h: 0.95, fontSize: 34,
      color: C.accent1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
});

const ANIM = {}; // slide number -> steps for animate.py
const TRANS = {};
let n = 0;
let lastSection = null;
function slide(section, kicker, title, master = "Starfield title only") {
  if (section) pres.addSection({ title: (lastSection = section) });
  const s = pres.addSlide({ masterName: master, sectionTitle: lastSection });
  n += 1;
  s._n = n;
  if (kicker) s.addText(kicker, { placeholder: "kicker" });
  if (title) s.addText(title, { placeholder: "title" });
  return s;
}
const anim = (s, steps) => (ANIM[s._n] = steps);
const T = (o) => ({ isTextBox: true, margin: 0, ...o });

function card(s, name, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: name, x, y, w, h, rectRadius: 0.08,
    fill: { color: C.text2, transparency: opts.clear ? 100 : 0 }, line: { color: HEX.line, width: 1 } });
}
function stat(s, name, x, y, w, big, label, o = {}) {
  s.addText([
    { text: big, options: { fontSize: o.size || 34, color: o.color || C.accent1, fontFace: THEME.headFontFace, breakLine: true } },
    { text: label, options: { fontSize: o.labelSize || 14, color: C.background2 } },
  ], T({ objectName: name, x, y, w, h: o.h || 1.2, valign: "top", paraSpaceAfter: 2 }));
}
const usd = (v) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const chartBase = {
  catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, valGridLine: { color: HEX.grid, size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineColor: HEX.line, valAxisLineShow: false, legendColor: HEX.muted, legendFontFace: "+mn-lt", legendFontSize: 12,
  titleColor: "FFFFFF", titleFontFace: "+mn-lt", titleFontSize: 14, showTitle: true, dataLabelColor: "FFFFFF",
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11,
};

// 1 ─ opening crawl (≈26 s) ───────────────────────────────────────
{
  const s = slide("Opening", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("crawl.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("stars.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "crawl" });
  s.addNotes("0:00–0:26. Let the crawl play. It names the product and sets up the problem: bare fields, dry seasons, a draining aquifer, and farmers without proof from their own field.");
  ANIM[s._n] = [{ media: "crawl", dur: 27000 }];
  TRANS[s._n] = "fade";
}

// 2 ─ problem (≈20 s) ─────────────────────────────────────────────
{
  const s = slide("Problem", "EPISODE I  ·  THE BARE FIELD", "Two farms losing soil, water and money");
  const cur = S(V, "current").m, az = S(AZ, "current").m;
  const cols = [
    { x: M, img: "img/vko_true.jpg", region: "East Kazakhstan", sub: "rain-fed steppe · wheat, wheat, black fallow",
      stats: [[`${Math.round(cur.loss_years * 100)}%`, "of seasons lose money"], [`${cur.erosion.toFixed(1)} t/ha`, "of soil lost a year"], [`${cur.bare_days} days`, "a year of bare soil"]] },
    { x: M + 5.9 + 0.333, img: "img/az_true.jpg", region: "Pinal County, Arizona", sub: "irrigated desert · cotton, durum, summer fallow",
      stats: [[`${az.bare_days} days`, "a year of bare soil"], [`${Math.round(az.irr[1]).toLocaleString("en-US")} mm`, "of groundwater pumped a year"], [`${az.erosion.toFixed(1)} t/ha`, "of soil lost a year"]] },
  ];
  cols.forEach((c, i) => {
    const g = `col${i}`;
    s.addImage({ path: path.join(__dirname, c.img), objectName: `${g}img`, x: c.x, y: TOP, w: 5.9, h: 2.45, sizing: { type: "cover", w: 5.9, h: 2.45 }, altText: "MODIS true colour image of the region" });
    s.addText([{ text: c.region, options: { fontSize: 16, bold: true, color: C.background1, breakLine: true } }, { text: c.sub, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `${g}reg`, x: c.x, y: 4.55, w: 5.9, h: 0.7, valign: "top" }));
    c.stats.forEach(([big, label], j) => stat(s, `${g}s${j}`, c.x + j * 2.0, 5.45, 1.9, big, label, { size: 26, h: 1.2 }));
  });
  s.addNotes("0:26–0:45. Two demo regions. East Kazakhstan: black fallow saves a year of rain but leaves the soil bare to the wind. Arizona: fields sit bare through the dust season while wells pump the aquifer. These are the current rotations, replayed on real 2002–2023 weather.");
  anim(s, [{ fx: "rise", names: ["col0img", "col0reg"], dur: 500 }, { fx: "fade", names: ["col0s0", "col0s1", "col0s2"], dur: 350, stagger: 120 },
           { fx: "rise", names: ["col1img", "col1reg"], dur: 500 }, { fx: "fade", names: ["col1s0", "col1s1", "col1s2"], dur: 350, stagger: 120 }]);
}

// 3 ─ map and data (≈25 s) ────────────────────────────────────────
{
  const s = slide("Product", "EPISODE II  ·  THE MAP", "Pick a field: every hexagon carries NASA data");
  s.addShape(pres.shapes.RECTANGLE, { objectName: "frame", x: M, y: TOP, w: 8.3, h: 4.63, fill: { color: C.text1 }, line: { color: HEX.line, width: 1 } });
  s.addImage({ path: B("shot_map.jpg"), objectName: "shot", x: M, y: TOP, w: 8.3, h: 4.63, altText: "Furrow field map: H3 cells over imagery, coloured by median profit, with a strategy table" });
  const x = 9.25, w = 3.48;
  const block = (name, y, h, head, lines, color) => s.addText([
    { text: head, options: { fontSize: 12, bold: true, charSpacing: 3, color, breakLine: true } },
    ...lines.map((l, i) => ({ text: l, options: { fontSize: 15, color: C.background1, breakLine: i < lines.length - 1 } })),
  ], T({ objectName: name, x, y, w, h, valign: "top", paraSpaceAfter: 6 }));
  block("live", TOP, 2.45, "LIVE IN THE APP", ["NASA POWER: 22 seasons of daily weather", "SoilGrids: clay, sand, organic carbon", "MODIS NDVI, SMAP, GPM IMERG and GRACE-FO on the map"], C.accent5);
  block("pipe", TOP + 2.55, 1.35, "IN THE PIPELINE", ["HLS crop history, SRTM slope, CMIP6 climate deltas"], C.accent2);
  s.addText(`${V.cells} cells in East Kazakhstan, ${AZ.cells} in Arizona, about 250 km² each. SMAP is 9 km, so the map never calls it your field.`,
    T({ objectName: "note", x, y: TOP + 3.75, w, h: 1.05, fontSize: 14, color: C.background2, valign: "top" }));
  s.addNotes("0:45–1:10. Pick a cell on the map. Each carries its own SoilGrids soil and 22 years of NASA POWER weather, with MODIS NDVI, SMAP, IMERG and GRACE-FO layers underneath through NASA GIBS. Colour the cells by profit, soil loss, carbon or water for any rotation.");
  anim(s, [{ fx: "zoom", names: ["frame", "shot"], dur: 700 }, { fx: "fade", names: ["live", "pipe", "note"], dur: 400, stagger: 200 }]);
}

// 4 ─ rotations over 22 seasons (≈30 s) ───────────────────────────
{
  const s = slide(null, "EPISODE III  ·  THE TIME MACHINE", "Four rotations, replayed over 22 real seasons");
  const st = V.strategies;
  s.addChart(pres.charts.LINE, st.map((x, i) => ({ name: ["Current", "Strategy A", "Strategy B", "Strategy C"][i], labels: st[0].years.map(String), values: x.median })),
    { ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.9, h: 4.85, chartColors: SC, lineSize: 2.5, lineDataSymbol: "none",
      title: "Median profit per hectare by harvest year, East Kazakhstan", valAxisLabelFormatCode: "$#,##0;−$#,##0",
      showLegend: true, legendPos: "b", catAxisLabelFrequency: 2 });
  const rows = [["Current", "wheat, wheat, black fallow"], ["A", "wheat, lentil, flax, wheat"], ["B", "wheat, pea, 2 years sainfoin"], ["C", "wheat, chickpea, millet"]];
  const x = 8.85, w = 3.88;
  rows.forEach(([id, rot], i) => {
    const y = TOP + i * 0.92;
    s.addShape(pres.shapes.OVAL, { objectName: `d${i}`, x, y: y + 0.07, w: 0.2, h: 0.2, fill: { color: [C.accent3, C.accent4, C.accent5, C.accent6][i] }, line: { type: "none" } });
    s.addText([{ text: `${id} · ${rot}`, options: { fontSize: 15, bold: true, color: C.background1, breakLine: true } },
      { text: `loses money in ${Math.round(st[i].m.loss_years * 100)}% of seasons`, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `r${i}`, x: x + 0.35, y, w: w - 0.35, h: 0.8, valign: "top", paraSpaceAfter: 2 }));
  });
  const v08 = (z) => z.median[z.years.indexOf(2008)];
  s.addText([{ text: "2008 drought", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: `current practice ${usd(v08(S(V, "current")))}/ha, rotation C still ${usd(v08(S(V, "C")))}/ha`, options: { color: C.background1 } }],
    T({ objectName: "y08", x, y: TOP + 3.85, w, h: 0.9, fontSize: 15, valign: "top" }));
  s.addNotes("1:10–1:40. Current practice against three alternatives, each a hypothesis with a written risk for the agronomist. Every season since 2002 is replayed on the field's own weather. In the 2008 drought every rotation suffers, but wheat, chickpea, millet stays positive. Thin local markets for chickpea are the risk to check.");
  anim(s, [{ fx: "wipeR", names: ["chart"], dur: 1500 }, ...[0, 1, 2, 3].map((i) => ({ fx: "rise", names: [`d${i}`, `r${i}`], dur: 350, gap: i ? -200 : -900 })), { fx: "fade", names: ["y08"], dur: 400 }]);
}

// 5 ─ what-if and search (≈30 s) ──────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE TRADE-OFF COCKPIT", `${V.searched} rotations searched, ${V.pareto} worth a farmer's look`);
  const groups = [["Searched", V.cloud], ["Best trade-offs", V.front], ...V.strategies.map((x, i) => [["Current", "A", "B", "C"][i], [[x.m.erosion, x.m.profit[1]]]])];
  const xs = [], series = groups.map(([name]) => ({ name, values: [] }));
  groups.forEach(([, pts], gi) => pts.forEach(([ex, py]) => { xs.push(ex); series.forEach((se, si) => se.values.push(si === gi ? py : null)); }));
  s.addChart(pres.charts.SCATTER, [{ name: "Soil loss", values: xs }, ...series], {
    ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.7, h: 4.85, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    lineDataSymbolLineSize: 0.5, chartColors: ["3A4160", HEX.yellow, ...SC], title: "Median profit against soil loss, East Kazakhstan",
    valAxisLabelFormatCode: "$#,##0;−$#,##0", showLegend: true, legendPos: "b", valAxisCrossesAt: -100,
    valAxisMinVal: -100, valAxisMaxVal: 400, catAxisMinVal: 0, catAxisMaxVal: 8,
    showCatAxisTitle: true, catAxisTitle: "Soil loss, t/ha a year", catAxisTitleColor: HEX.muted, catAxisTitleFontSize: 12, catAxisTitleFontFace: "+mn-lt" });
  const cur = S(V, "current"), c = S(V, "C"), a = S(AZ, "A"), azc = S(AZ, "current"), x = 8.65, w = 4.08;
  stat(s, "s0", x, TOP, w, `${V.pareto} of ${V.searched}`, "rotations NSGA-II found that nothing beats on profit, bad-year profit, soil loss and carbon together", { size: 30, h: 1.5 });
  stat(s, "s1", x, TOP + 1.65, w, `${usd(c.twin)} vs ${usd(cur.twin)}`, "median per hectare at +2 °C and 10% less rain: rotation C against today's practice", { size: 30, h: 1.5 });
  stat(s, "s2", x, TOP + 3.3, w, `+${usd(a.m.profit[1] - azc.m.profit[1])}, −${Math.round(a.water_saved)} mm`, "in Arizona, durum and guar on drip against cotton, durum, fallow", { size: 30, h: 1.5 });
  s.addNotes("1:40–2:10. NSGA-II searched hundreds of rotations; the yellow front is where the real choices are, and today's rotation sits far right, losing soil for little profit. The climate twin replays the same record two degrees warmer and ten percent drier: current practice goes negative, C keeps most of its margin. In Arizona the water-wise rotation earns more and pumps less.");
  anim(s, [{ fx: "fade", names: ["chart"], dur: 800 }, { fx: "rise", names: ["s0"], dur: 400 }, { fx: "rise", names: ["s1"], dur: 400 }, { fx: "rise", names: ["s2"], dur: 400 }]);
}

// 6 ─ engine and ML (≈25 s) ───────────────────────────────────────
{
  const s = slide("Models", "EPISODE V  ·  THE ENGINE", "Simple models now, a satellite ML layer next");
  const w = 5.9, h = 3.95, xr = M + w + 0.333;
  card(s, "lbg", M, TOP, w, h);
  card(s, "rbg", xr, TOP, w, h);
  const models = [["Water and yield", "FAO-56 bucket, FAO-33 yield response"], ["Erosion", "RWEQ-style wind, RUSLE water"], ["Soil carbon", "RothC-26.3, from SoilGrids carbon"],
    ["Search", "NSGA-II over rotations of up to 4 crops"], ["Uncertainty", "P10 to P90 over 22 years and every start year"]];
  s.addText([{ text: "MODELS IN FURROW", options: { fontSize: 12, bold: true, charSpacing: 3, color: C.accent1, breakLine: true } },
    ...models.flatMap(([a, b], i) => [{ text: `${a}  `, options: { fontSize: 15, bold: true, color: C.background1 } },
      { text: b, options: { fontSize: 15, color: C.background2, breakLine: i < models.length - 1 } }])],
    T({ objectName: "lt", x: M + 0.3, y: TOP + 0.3, w: w - 0.6, h: h - 0.6, valign: "top", paraSpaceAfter: 14 }));
  const ml = [["HLS L30 v2.0 searched with earthaccess", 1], ["Fmask cloud filter ≤ 20%, 8 dates in 2021", 1], ["1.5 GB download guard, lazy band reads", 1],
    ["NDVI features, under 0.2 counts as bare", 0], ["Crop and bare-soil classifier per field", 0]];
  s.addText("FIELD SHIFT ML  ·  CARVER-ML REPO", T({ objectName: "rh", x: xr + 0.3, y: TOP + 0.3, w: w - 0.6, h: 0.3, fontSize: 12, bold: true, charSpacing: 3, color: C.accent2 }));
  ml.forEach(([t, done], i) => {
    const y = TOP + 0.76 + i * 0.44;
    s.addText(done ? "DONE" : "NEXT", T({ objectName: `mc${i}`, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.05, x: xr + 0.3, y: y + 0.02, w: 0.72, h: 0.26,
      fontSize: 9, bold: true, charSpacing: 1, align: "center", valign: "middle", color: C.text1, fill: { color: done ? C.accent5 : C.accent1 } }));
    s.addText(t, T({ objectName: `mt${i}`, x: xr + 1.2, y, w: w - 1.5, h: 0.32, fontSize: 15, color: C.background1, valign: "middle" }));
  });
  s.addText("Output per field: crop history with probability, bare-soil days with a confidence interval, and a domain-shift flag that tells the agronomist where to check first.",
    T({ objectName: "out", x: xr + 0.3, y: TOP + 3.0, w: w - 0.6, h: 0.85, fontSize: 13, color: C.background2, valign: "top" }));
  s.addText("Prices and costs are round assumptions for an agronomist to replace. Erosion and carbon compare rotations; they are not field measurements.",
    T({ objectName: "lim", x: M, y: TOP + 4.2, w: CW, h: 0.35, fontSize: 12, color: C.background2 }));
  s.addNotes("2:10–2:35. The models are small and replaceable: AquaCrop can take over per crop through the same interfaces. The ML repository already pulls Harmonized Landsat scenes from NASA Earthdata with a cloud filter and a size guard; feature extraction and the classifier are next, and they plug into the map through a JSON contract per cell.");
  anim(s, [{ fx: "fade", names: ["lbg", "lt"], dur: 500 }, { fx: "fade", names: ["rbg", "rh"], dur: 400 },
    ...[0, 1, 2, 3, 4].map((i) => ({ fx: "rise", names: [`mc${i}`, `mt${i}`], dur: 300, gap: i ? -150 : 0 })), { fx: "fade", names: ["out", "lim"], dur: 400 }]);
}

// 7 ─ close (≈20 s) ───────────────────────────────────────────────
{
  const s = slide("Close", null, null, "Starfield blank");
  s.addImage({ path: B("planet.png"), objectName: "planet", x: 1.17, y: 4.35, w: 11, h: 11, altText: "East Kazakhstan fields seen by MODIS, wrapped on a globe" });
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 0.7, w: CW, h: 1.1, fontSize: 72, color: C.accent1, align: "center", charSpacing: 6, fontFace: THEME.headFontFace }));
  s.addText("It shows what each choice would have cost and kept.", T({ objectName: "l1", x: M, y: 2.0, w: CW, h: 0.6, fontSize: 28, color: C.background1, align: "center" }));
  s.addText("The farmer decides.", T({ objectName: "l2", x: M, y: 2.65, w: CW, h: 0.6, fontSize: 28, color: C.accent1, align: "center" }));
  s.addText("Ranges, never promises  ·  hypotheses for the agronomist  ·  an assistant that only quotes the model", T({ objectName: "g", x: M, y: 3.45, w: CW, h: 0.4, fontSize: 15, color: C.background2, align: "center" }));
  s.addNotes("2:35–3:00. Furrow does not tell a farmer what to plant. It shows what each choice would have cost and kept, as ranges over real weather. The in-app assistant answers only from computed results. Built on NASA data, open source, a static site with no backend.");
  anim(s, [{ fx: "rise", names: ["planet"], dur: 1300, dy: 0.25 }, { fx: "fade", names: ["logo"], dur: 600, gap: -500 }, { fx: "fade", names: ["l1"], dur: 500 }, { fx: "fade", names: ["l2"], dur: 500 }, { fx: "fade", names: ["g"], dur: 400 }]);
  TRANS[s._n] = "fade";
}

(async () => {
  const out = B("furrow.pptx");
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(B("anim.json"), JSON.stringify({ anim: ANIM, trans: TRANS, theme: THEME }));
  console.log("wrote", out, n, "slides");
})();
