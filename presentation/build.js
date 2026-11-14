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
  headFontFace: "Franklin Gothic Medium",
  bodyFontFace: "Arial",
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
      color: C.accent1, margin: 0, valign: "top" }, text: "" } },
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
const shadowGlow = (color = HEX.holo) => ({ type: "outer", color, blur: 16, offset: 0, angle: 90, opacity: 0.45 });

function card(s, name, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: name, x, y, w, h, rectRadius: 0.08,
    fill: { color: C.text2, transparency: opts.clear ? 100 : 0 }, line: { color: HEX.line, width: 1 } });
}
function stat(s, name, x, y, w, big, label, o = {}) {
  s.addText([
    { text: big, options: { fontSize: o.size || 34, color: o.color || C.accent1, bold: true, fontFace: THEME.headFontFace, breakLine: true } },
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

// 1 ─ opening crawl ───────────────────────────────────────────────
{
  const s = slide("Opening", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("crawl.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("stars.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "crawl" });
  s.addNotes("Let the crawl run (about 50 seconds), or click to skip. It sets up the problem: bare fields, dry seasons, a draining aquifer, and farmers without proof from their own field.");
  ANIM[s._n] = [{ media: "crawl", dur: 50000 }];
  TRANS[s._n] = "fade";
}

// 2 ─ title ───────────────────────────────────────────────────────
{
  const s = slide(null, null, null, "Starfield blank");
  s.addImage({ path: B("planet.png"), objectName: "planet", x: 6.9, y: 0.55, w: 6.4, h: 6.4, altText: "East Kazakhstan fields seen by MODIS, wrapped on a globe" });
  s.addText("NASA SPACE APPS 2026  ·  ADAPTING FARMS WITH NASA DATA", T({ objectName: "kick", x: M, y: 1.75, w: 6.2, h: 0.35, fontSize: 13, bold: true, color: C.accent2, charSpacing: 3 }));
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 2.2, w: 6.2, h: 1.45, fontSize: 96, bold: true, fontFace: THEME.headFontFace, color: C.accent1, charSpacing: 6, glow: { size: 12, opacity: 0.35, color: HEX.yellow } }));
  s.addText("Crop rotation planner for dry farms, built on NASA data", T({ objectName: "sub", x: M, y: 3.85, w: 6.0, h: 1.0, fontSize: 26, color: C.background1, valign: "top" }));
  s.addText("One field  ·  four rotations  ·  twenty-two real seasons", T({ objectName: "line", x: M, y: 5.05, w: 6.0, h: 0.4, fontSize: 16, color: C.background2 }));
  s.addNotes("Furrow is a crop rotation planner for dry farms. The planet on the right is real: a MODIS frame of the East Kazakhstan fields we model, 30 August 2022.");
  anim(s, [{ fx: "zoom", names: ["planet"], dur: 1200 }, { fx: "wipeR", names: ["kick", "logo"], dur: 700, gap: -500 }, { fx: "rise", names: ["sub", "line"], dur: 600, stagger: 200 }]);
}

// 3 ─ problem ─────────────────────────────────────────────────────
{
  const s = slide("Problem", "EPISODE I  ·  THE BARE FIELD", "Two farms losing soil, water and money");
  const cur = S(V, "current").m, az = S(AZ, "current").m;
  const cols = [
    { x: M, img: "img/vko_true.jpg", region: "East Kazakhstan · rain-fed steppe · wheat, wheat, black fallow",
      stats: [[`${Math.round(cur.loss_years * 100)}%`, "of seasons lose money"], [`${cur.erosion.toFixed(1)} t`, "of soil lost per hectare a year"], [`${cur.bare_days} days`, "a year the soil lies bare"]] },
    { x: M + 5.9 + 0.333, img: "img/az_true.jpg", region: "Pinal County, Arizona · irrigated desert · cotton, durum, fallow",
      stats: [[`${az.bare_days} days`, "a year the soil lies bare"], [`${Math.round(az.irr[1]).toLocaleString("en-US")} mm`, "of groundwater pumped a year"], [`${az.erosion.toFixed(1)} t`, "of soil lost per hectare a year"]] },
  ];
  cols.forEach((c, i) => {
    const g = `col${i}`;
    s.addImage({ path: path.join(__dirname, c.img), objectName: `${g}img`, x: c.x, y: TOP, w: 5.9, h: 2.55, sizing: { type: "cover", w: 5.9, h: 2.55 }, altText: "MODIS true colour image of the region" });
    s.addText(c.region, T({ objectName: `${g}reg`, x: c.x, y: 4.68, w: 5.9, h: 0.35, fontSize: 15, bold: true, color: C.background1 }));
    c.stats.forEach(([big, label], j) => stat(s, `${g}s${j}`, c.x + j * 2.0, 5.2, 1.9, big, label, { size: 30, h: 1.4 }));
  });
  s.addNotes("Two demo regions. East Kazakhstan: black fallow saves a year of rain but leaves the soil bare and blowing. Arizona: fields sit bare through the dust season while wells pump the aquifer. Numbers are the current rotation on the reference field, replayed over 2002 to 2023.");
  anim(s, [{ fx: "rise", names: ["col0img", "col0reg"], dur: 600 }, { fx: "fade", names: ["col0s0", "col0s1", "col0s2"], dur: 400, stagger: 150 },
           { fx: "rise", names: ["col1img", "col1reg"], dur: 600 }, { fx: "fade", names: ["col1s0", "col1s1", "col1s2"], dur: 400, stagger: 150 }]);
}

// 4 ─ the mission ─────────────────────────────────────────────────
{
  const s = slide("Solution", "EPISODE II  ·  THE MISSION", "Pick a field, see what each rotation would have done");
  const steps = [
    ["Pick a field", "A hexagon on the map, with NASA layers underneath"],
    ["Compare four rotations", "Current practice against three hypotheses"],
    ["Replay 22 seasons", "Real NASA POWER weather, 2002 to 2023"],
    ["Warm the climate", "The same field at +2 °C and 10% less rain"],
    ["Search hundreds", "NSGA-II finds the rotations nothing beats"],
  ];
  const colW = CW / 5, cy = 2.75, d = 0.9;
  s.addShape(pres.shapes.LINE, { objectName: "route", x: M + colW / 2, y: cy, w: colW * 4, h: 0, line: { color: HEX.holo, width: 2 } });
  steps.forEach(([h, t], i) => {
    const cx = M + colW * i + colW / 2;
    s.addShape(pres.shapes.OVAL, { objectName: `n${i}`, x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color: C.text1 }, line: { color: HEX.yellow, width: 2 }, shadow: shadowGlow(HEX.yellow) });
    s.addText(String(i + 1), T({ objectName: `nt${i}`, x: cx - d / 2, y: cy - d / 2, w: d, h: d, align: "center", valign: "middle", fontSize: 26, bold: true, fontFace: THEME.headFontFace, color: C.accent1 }));
    s.addText([{ text: h, options: { fontSize: 18, bold: true, color: C.background1, breakLine: true } }, { text: t, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `l${i}`, x: M + colW * i + 0.1, y: 3.55, w: colW - 0.2, h: 1.5, align: "center", valign: "top", paraSpaceAfter: 6 }));
  });
  s.addText("Furrow lays out the trade-offs. The farmer and the agronomist make the decision.", T({ objectName: "close", x: M, y: 5.65, w: CW, h: 0.6, fontSize: 22, color: C.accent1, align: "center" }));
  s.addNotes("The flow of the app in five moves. Every number is a range over real weather, never a single promise.");
  anim(s, [{ fx: "wipeR", names: ["route"], dur: 900 },
    ...[0, 1, 2, 3, 4].map((i) => ({ fx: "zoom", names: [`n${i}`, `nt${i}`, `l${i}`], dur: 450, gap: i ? -150 : -600 })),
    { fx: "fade", names: ["close"], dur: 600 }]);
}

// 5 ─ data fleet ──────────────────────────────────────────────────
{
  const s = slide("Data", "EPISODE III  ·  THE DATA FLEET", "Nine datasets: six live in the app, three in the pipeline");
  const items = [
    ["NASA POWER", "Daily rain, heat, wind and sun for 22 seasons, every cell", 1],
    ["ISRIC SoilGrids 2.0", "Clay, sand and organic carbon, 0–30 cm, every cell", 1],
    ["MODIS NDVI", "16-day vegetation index under the map, via NASA GIBS", 1],
    ["SMAP", "Soil moisture at 9 km: the district, never your field", 1],
    ["GPM IMERG", "Rainfall estimates layered under the field map", 1],
    ["GRACE-FO", "Groundwater storage trend over the Arizona aquifer", 1],
    ["HLS Landsat + Sentinel-2", "30 m reflectance for crop history, ingested by the ML repo", 0],
    ["SRTM", "Slope for the water-erosion factor in RUSLE", 0],
    ["NEX-GDDP-CMIP6", "SSP2-4.5 and SSP5-8.5 climate deltas per cell", 0],
  ];
  const w = 3.9, h = 1.45, gx = 0.2, gy = 0.2;
  const names = [];
  items.forEach(([t, d, live], i) => {
    const x = M + (i % 3) * (w + gx), y = TOP + Math.floor(i / 3) * (h + gy), g = `c${i}`;
    card(s, `${g}bg`, x, y, w, h);
    s.addText(t, T({ objectName: `${g}t`, x: x + 0.25, y: y + 0.2, w: w - 1.75, h: 0.35, fontSize: 16, bold: true, color: C.background1 }));
    s.addText(live ? "LIVE" : "PIPELINE", T({ objectName: `${g}chip`, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: x + w - 1.3, y: y + 0.2, w: 1.05, h: 0.3,
      fontSize: 10, bold: true, charSpacing: 2, align: "center", valign: "middle", color: C.text1, fill: { color: live ? C.accent5 : C.accent2 } }));
    s.addText(d, T({ objectName: `${g}d`, x: x + 0.25, y: y + 0.65, w: w - 0.5, h: 0.65, fontSize: 14, color: C.background2, valign: "top" }));
    names.push([`${g}bg`, `${g}t`, `${g}chip`, `${g}d`]);
  });
  s.addNotes("Six layers run in the app today without any login: NASA POWER and SoilGrids per cell, and four NASA GIBS layers on the map. The Earth Engine script adds HLS, SRTM and CMIP6 deltas once a project key is set. SMAP is 9 km, so we never call it your field's moisture.");
  anim(s, names.map((g, i) => ({ fx: "rise", names: g, dur: 450, gap: i ? -330 : 0 })));
}

// 6 ─ map ─────────────────────────────────────────────────────────
{
  const s = slide("Product", "EPISODE IV  ·  THE MAP", "Every hexagon carries its own soil and weather");
  s.addShape(pres.shapes.RECTANGLE, { objectName: "glow", x: M, y: TOP, w: 8.3, h: 4.79, fill: { color: C.text1 }, line: { color: HEX.holo, width: 1.25 }, shadow: shadowGlow() });
  s.addImage({ path: B("shot_map.jpg"), objectName: "shot", x: M, y: TOP, w: 8.3, h: 4.79, altText: "Furrow field map: H3 cells over imagery, coloured by median profit, with a strategy table" });
  const x = 9.25, w = 3.48;
  stat(s, "s0", x, TOP, w, String(V.cells), "hexagon cells in East Kazakhstan", { size: 40 });
  stat(s, "s1", x, TOP + 1.25, w, String(AZ.cells), "cells in Pinal County, Arizona", { size: 40 });
  stat(s, "s2", x, TOP + 2.5, w, "≈250 km²", "per H3 cell, each with its own SoilGrids soil and NASA POWER weather", { size: 40, h: 1.5 });
  s.addText("SMAP and IMERG pixels are 9–11 km. The map shows them as the district and never as your field.", T({ objectName: "note", x, y: 5.95, w, h: 0.8, fontSize: 14, color: C.accent2, valign: "top" }));
  s.addNotes("The map: colour the cells by profit, soil loss, carbon or water for any strategy, with MODIS NDVI, SMAP, IMERG or GRACE-FO underneath. Click a cell to see its soil and the four strategies side by side.");
  anim(s, [{ fx: "zoom", names: ["glow", "shot"], dur: 800 }, { fx: "fade", names: ["s0", "s1", "s2", "note"], dur: 400, stagger: 200 }]);
}

// 7 ─ strategies chart ────────────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE STRATEGIES", "Four rotations, each a hypothesis for the agronomist");
  const st = V.strategies;
  const labels = ["Current", "A", "B", "C"];
  s.addChart(pres.charts.BAR, [
    { name: "1-in-10 bad year", labels, values: st.map((x) => x.m.profit[0]) },
    { name: "Median", labels, values: st.map((x) => x.m.profit[1]) },
    { name: "1-in-10 good year", labels, values: st.map((x) => x.m.profit[2]) },
  ], { ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.3, h: 4.85, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.red, HEX.yellow, HEX.holo], title: "Profit per hectare, East Kazakhstan, 22 seasons",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "$#,##0;−$#,##0", valAxisLabelFormatCode: "$#,##0;−$#,##0",
    showLegend: true, legendPos: "b" });
  const rows = [
    ["Current", "wheat, wheat, black fallow", st[0]], ["A", "wheat, lentil, flax, wheat · no-till", st[1]],
    ["B", "wheat, pea, sainfoin ×2, wheat · no-till", st[2]], ["C", "wheat, chickpea, millet · no-till", st[3]],
  ];
  const x = 8.3, w = 4.43;
  rows.forEach(([id, rot, d], i) => {
    const y = TOP + i * 1.2;
    s.addShape(pres.shapes.OVAL, { objectName: `d${i}`, x, y: y + 0.08, w: 0.22, h: 0.22, fill: { color: [C.accent3, C.accent4, C.accent5, C.accent6][i] }, line: { type: "none" } });
    s.addText([{ text: `${id} · ${rot}`, options: { fontSize: 15, bold: true, color: C.background1, breakLine: true } },
      { text: `loses money in ${Math.round(d.m.loss_years * 100)}% of seasons · ${d.m.erosion.toFixed(1)} t soil a year`, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `r${i}`, x: x + 0.38, y, w: w - 0.38, h: 1.0, valign: "top", paraSpaceAfter: 4 }));
  });
  s.addNotes("Each bar group is one rotation on the reference field: the 1-in-10 bad year, the median, the 1-in-10 good year. Current practice loses money in 41% of seasons. The drought-tolerant rotation C loses in 2%. These are hypotheses with written risks, for example thin local markets for chickpea and millet.");
  anim(s, [{ fx: "wipeU", names: ["chart"], dur: 900 }, ...[0, 1, 2, 3].map((i) => ({ fx: "rise", names: [`d${i}`, `r${i}`], dur: 400, gap: i ? -250 : 0 }))]);
}

// 8 ─ time machine ────────────────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE TIME MACHINE", "Replay every season since 2002");
  const st = V.strategies;
  const labels = st[0].years.map(String);
  s.addChart(pres.charts.LINE, st.map((x, i) => ({ name: ["Current", "Strategy A", "Strategy B", "Strategy C"][i], labels, values: x.median })),
    { ...chartBase, objectName: "chart", x: M, y: TOP, w: 8.5, h: 4.85, chartColors: SC, lineSize: 2.5, lineDataSymbol: "none",
      title: "Median profit per hectare by harvest year, East Kazakhstan", valAxisLabelFormatCode: "$#,##0;−$#,##0",
      showLegend: true, legendPos: "b", catAxisLabelFrequency: 2 });
  const x = 9.45, w = 3.28, cur = S(V, "current"), c = S(V, "C");
  const v08 = (z) => z.median[z.years.indexOf(2008)];
  s.addText("2008", T({ objectName: "yr", x, y: TOP, w, h: 1.0, fontSize: 60, bold: true, fontFace: THEME.headFontFace, color: C.accent1 }));
  s.addText(`The drought year. Current practice loses ${usd(-v08(cur))} a hectare at the median. Wheat, chickpea, millet still makes ${usd(v08(c))}.`,
    T({ objectName: "t1", x, y: TOP + 1.15, w, h: 1.6, fontSize: 16, color: C.background1, valign: "top" }));
  s.addText("The line is the median over every year the rotation could have started. The app shades the full spread and shows soil water day by day.",
    T({ objectName: "t2", x, y: TOP + 2.95, w, h: 1.5, fontSize: 14, color: C.background2, valign: "top" }));
  s.addNotes("Slide to the worst drought year and watch which rotations run short of water. This is the risk the farmer is right to fear, made visible.");
  anim(s, [{ fx: "wipeR", names: ["chart"], dur: 1600 }, { fx: "zoom", names: ["yr"], dur: 500 }, { fx: "fade", names: ["t1", "t2"], dur: 500, stagger: 250 }]);
}

// 9 ─ climate twin ────────────────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE CLIMATE TWIN", "Two degrees warmer, ten percent less rain");
  const st = V.strategies, labels = ["Current", "A", "B", "C"];
  s.addChart(pres.charts.BAR, [
    { name: "2002–2023 weather", labels, values: st.map((x) => x.today) },
    { name: "+2 °C, −10% rain", labels, values: st.map((x) => x.twin) },
  ], { ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.3, h: 4.85, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
    chartColors: [HEX.holo, HEX.red], title: "Median profit per hectare, East Kazakhstan", showValue: true, dataLabelPosition: "outEnd",
    dataLabelFormatCode: "$#,##0;−$#,##0", valAxisLabelFormatCode: "$#,##0;−$#,##0", showLegend: true, legendPos: "b" });
  const cur = S(V, "current"), c = S(V, "C"), x = 8.3, w = 4.43;
  stat(s, "s0", x, TOP, w, usd(cur.twin), `median for current practice in the warmer twin, losing money in ${Math.round(cur.twin_loss * 100)}% of seasons`, { size: 44, color: HEX.red, h: 1.55 });
  stat(s, "s1", x, TOP + 1.75, w, usd(c.twin), `for wheat, chickpea, millet, losing money in ${Math.round(c.twin_loss * 100)}% of seasons`, { size: 44, h: 1.55 });
  s.addText("A scenario, not a forecast: the real 2002–2023 record shifted by temperature and rain. The Earth Engine script adds CMIP6 deltas per cell.",
    T({ objectName: "note", x, y: TOP + 3.6, w, h: 1.2, fontSize: 14, color: C.accent2, valign: "top" }));
  s.addNotes("The climate twin replays the same field in a warmer, drier record. Which rotation still pays? Current practice goes negative; the drought-tolerant rotation keeps most of its margin.");
  anim(s, [{ fx: "wipeU", names: ["chart"], dur: 900 }, { fx: "rise", names: ["s0"], dur: 450 }, { fx: "rise", names: ["s1"], dur: 450 }, { fx: "fade", names: ["note"], dur: 500 }]);
}

// 10 ─ trade-off cockpit ──────────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE TRADE-OFF COCKPIT", `${V.searched} rotations searched, ${V.pareto} that nothing beats`);
  const groups = [
    ["Searched", V.cloud], ["Best trade-offs", V.front],
    ...V.strategies.map((x, i) => [["Current", "A", "B", "C"][i], [[x.m.erosion, x.m.profit[1]]]]),
  ];
  const xs = [], series = groups.map(([name]) => ({ name, values: [] }));
  groups.forEach(([, pts], gi) => pts.forEach(([ex, py]) => {
    xs.push(ex);
    series.forEach((se, si) => se.values.push(si === gi ? py : null));
  }));
  s.addChart(pres.charts.SCATTER, [{ name: "Soil loss", values: xs }, ...series], {
    ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.7, h: 4.85, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    lineDataSymbolLineSize: 0.5, chartColors: ["4A5270", HEX.yellow, ...SC], title: "Median profit against soil loss, East Kazakhstan",
    valAxisLabelFormatCode: "$#,##0;−$#,##0", catAxisLabelFormatCode: "0.0\" t\"", showLegend: true, legendPos: "b",
    valAxisMinVal: -100, valAxisMaxVal: 400, catAxisMinVal: 0, catAxisMaxVal: 8 });
  const x = 8.65, w = 4.08;
  stat(s, "s0", x, TOP, w, String(V.searched), "rotations of up to four crops scored by NSGA-II on the reference field", { size: 44, h: 1.4 });
  stat(s, "s1", x, TOP + 1.55, w, String(V.pareto), "on the front: none of them can gain on one count without losing on another", { size: 44, h: 1.4 });
  s.addText("The farmer sets limits, such as the most soil they will lose and the worst year they can survive. The list keeps only what fits.",
    T({ objectName: "note", x, y: TOP + 3.2, w, h: 1.4, fontSize: 15, color: C.background1, valign: "top" }));
  s.addNotes("NSGA-II searched hundreds of rotations, scoring median profit, bad-year profit, soil loss and soil carbon (and pumped water in Arizona). The current rotation sits far right: high soil loss, low profit. The yellow front is where the real choices are.");
  anim(s, [{ fx: "fade", names: ["chart"], dur: 900 }, { fx: "rise", names: ["s0"], dur: 450 }, { fx: "rise", names: ["s1"], dur: 450 }, { fx: "fade", names: ["note"], dur: 500 }]);
}

// 11 ─ water and carbon ───────────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  WATER AND CARBON", "Water left in the aquifer, carbon kept in the soil");
  const st = AZ.strategies;
  s.addChart(pres.charts.BAR, [{ name: "Pumped water", labels: ["Current", "A · drip", "B · cover", "C · winter only"], values: st.map((x) => x.m.irr[1]) }],
    { ...chartBase, objectName: "chart", x: M, y: TOP, w: 6.6, h: 4.85, barDir: "col", barGapWidthPct: 55, chartColors: SC,
      title: "Groundwater pumped, mm a year (median), Pinal County", showValue: true, dataLabelPosition: "outEnd",
      dataLabelFormatCode: "#,##0", valAxisLabelFormatCode: "#,##0", showLegend: false });
  const a = S(AZ, "A"), cur = S(AZ, "current"), c = S(AZ, "C"), b = S(V, "B"), x = 7.65, w = 5.08;
  stat(s, "s0", x, TOP, w, `+${usd(a.m.profit[1] - cur.m.profit[1])}`, `median profit per hectare for durum and guar on drip, pumping ${Math.round(a.water_saved)} mm less a year`, { size: 36, h: 1.4 });
  stat(s, "s1", x, TOP + 1.6, w, `${Math.round(c.water_saved)} mm`, "a year left in the aquifer by winter-only grain, at the lowest income of the four", { size: 36, h: 1.4 });
  stat(s, "s2", x, TOP + 3.2, w, `${b.carbon.t_co2_ha_yr} t CO₂e`, `per hectare a year kept by the sainfoin rotation in East Kazakhstan: ${usd(b.carbon.usd_ha_yr[0])}–${usd(b.carbon.usd_ha_yr[1])} if a registry verifies it with soil samples`, { size: 36, color: HEX.B, h: 1.6 });
  s.addNotes("In Arizona the water-wise rotation earns more and pumps less than today. Winter-only grain leaves the most water in the aquifer but needs water-saving payments. Soil carbon comes from RothC, with a 20% buffer and a $15 to $35 per tonne range; real payment needs soil samples and a registry method such as Verra VM0042.");
  anim(s, [{ fx: "wipeU", names: ["chart"], dur: 900 }, { fx: "rise", names: ["s0"], dur: 450 }, { fx: "rise", names: ["s1"], dur: 450 }, { fx: "rise", names: ["s2"], dur: 450 }]);
}

// 12 ─ ML ─────────────────────────────────────────────────────────
{
  const s = slide("Models", "EPISODE V  ·  THE SATELLITE EYE", "Field Shift ML: what the satellite saw on each field");
  const steps = [
    ["HLS L30 v2.0", "Landsat surface reflectance, searched with earthaccess", "DONE"],
    ["Cloud filter", "Fmask ≤ 20%, 8 dates, April to October 2021", "DONE"],
    ["Size guard", "Refuses downloads over 1.5 GB, reads bands lazily", "DONE"],
    ["Features", "Indices per window; NDVI under 0.2 is bare soil", "NEXT"],
    ["Classifier", "Crop type and bare-soil days for each field", "NEXT"],
  ];
  const w = 2.25, gap = (CW - 5 * w) / 4, h = 1.95, names = [];
  steps.forEach(([t, d, st], i) => {
    const x = M + i * (w + gap), g = `b${i}`;
    card(s, `${g}bg`, x, TOP, w, h);
    s.addText(t, T({ objectName: `${g}t`, x: x + 0.2, y: TOP + 0.18, w: w - 0.4, h: 0.35, fontSize: 16, bold: true, color: C.background1 }));
    s.addText(d, T({ objectName: `${g}d`, x: x + 0.2, y: TOP + 0.58, w: w - 0.4, h: 0.85, fontSize: 14, color: C.background2, valign: "top" }));
    s.addText(st, T({ objectName: `${g}c`, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: x + 0.2, y: TOP + h - 0.45, w: 0.85, h: 0.28,
      fontSize: 10, bold: true, charSpacing: 2, align: "center", valign: "middle", color: C.text1, fill: { color: st === "DONE" ? C.accent5 : C.accent1 } }));
    names.push([`${g}bg`, `${g}t`, `${g}d`, `${g}c`]);
  });
  const cy = TOP + h + 0.35, ch = 6.75 - cy;
  card(s, "codebg", M, cy, 6.6, ch);
  const code = [
    ["FieldAnalysis", HEX.yellow], ["  field_id, region, model_version", "FFFFFF"],
    ["  crop_history[]   year · crop · prob 0–1", "FFFFFF"], ["  bare_soil[]      year · days · ci_low ≤ days ≤ ci_high", "FFFFFF"],
    ["  domain_shift     field unlike the training data", "FFFFFF"], ["  data_gaps[]      cloudy or missing scenes", "FFFFFF"],
  ];
  s.addText(code.map(([t, col], i) => ({ text: t, options: { color: col, breakLine: i < code.length - 1 } })),
    T({ objectName: "code", x: M + 0.3, y: cy + 0.25, w: 6.1, h: ch - 0.5, fontSize: 14, fontFace: "Consolas", valign: "top", paraSpaceAfter: 4 }));
  s.addText([
    { text: "Why Furrow needs it", options: { fontSize: 18, bold: true, color: C.background1, breakLine: true } },
    { text: "Satellite crop history replaces the assumed current rotation. Bare-soil days arrive with a confidence interval, so erosion risk carries its uncertainty, and domain_shift marks fields an agronomist should check first.", options: { fontSize: 14, color: C.background2, breakLine: true } },
    { text: "Then: Prithvi-EO-2.0 fine-tuned on the USDA Cropland Data Layer, and SMAP downscaled toward the field.", options: { fontSize: 14, color: C.accent2 } },
  ], T({ objectName: "why", x: 7.5, y: cy + 0.05, w: 5.23, h: ch - 0.05, valign: "top", paraSpaceAfter: 10 }));
  s.addNotes("The ML lives in a separate repository, carver-ml. Ingestion from NASA Earthdata and the output contract are done and typed with pydantic; feature extraction and the classifier are next. The app reads the result through a plain JSON contract per H3 cell, and if the file is missing nothing breaks.");
  anim(s, [...names.map((g, i) => ({ fx: "rise", names: g, dur: 400, gap: i ? -250 : 0 })), { fx: "fade", names: ["codebg", "code"], dur: 500 }, { fx: "fade", names: ["why"], dur: 500 }]);
}

// 13 ─ models ─────────────────────────────────────────────────────
{
  const s = slide(null, "EPISODE V  ·  THE ENGINE", "Simple models, honest about their limits");
  const items = [
    ["Water and yield", "FAO-56 bucket · FAO-33", "Daily soil water in 1.2 m, Hargreaves ET0, yield response, heat stress at flowering"],
    ["Wind erosion", "RWEQ-style index", "Erodible fraction × gust excess cubed × bare days × dry soil"],
    ["Water erosion", "RUSLE", "Rain factor from annual rain, soil factor from texture; SRTM slope next"],
    ["Soil carbon", "RothC-26.3", "Monthly carbon pools, started from SoilGrids organic carbon"],
    ["Search", "NSGA-II", "48 rotations × 30 generations; 4 objectives, 5 with water in Arizona"],
    ["Uncertainty", "P10 · median · P90", "Every number spread over 22 weather years and every start year"],
  ];
  const w = 3.9, h = 2.0, gx = 0.2, gy = 0.2, names = [];
  items.forEach(([t, m, d], i) => {
    const x = M + (i % 3) * (w + gx), y = TOP + Math.floor(i / 3) * (h + gy), g = `m${i}`;
    card(s, `${g}bg`, x, y, w, h);
    s.addText([{ text: t, options: { fontSize: 18, bold: true, color: C.background1, breakLine: true } },
      { text: m, options: { fontSize: 14, color: C.accent1, breakLine: true } },
      { text: d, options: { fontSize: 14, color: C.background2 } }], T({ objectName: `${g}t`, x: x + 0.25, y: y + 0.2, w: w - 0.5, h: h - 0.4, valign: "top", paraSpaceAfter: 6 }));
    names.push([`${g}bg`, `${g}t`]);
  });
  s.addText("Prices and costs are round assumptions for an agronomist to replace. Erosion and carbon compare rotations; they are not field measurements.",
    T({ objectName: "lim", x: M, y: 6.4, w: CW, h: 0.45, fontSize: 14, color: C.accent2 }));
  s.addNotes("Each model is small and replaceable: AquaCrop can take over per crop through the same simulate and run_strategy interfaces. We read differences between strategies, not absolute trends.");
  anim(s, [...names.map((g, i) => ({ fx: "rise", names: g, dur: 400, gap: i ? -280 : 0 })), { fx: "fade", names: ["lim"], dur: 500 }]);
}

// 14 ─ assistant and guardrails ───────────────────────────────────
{
  const s = slide("Close", "EPISODE VI  ·  THE FARMER DECIDES", "An assistant that only quotes the model");
  const px = M, pw = 6.3, ph = 4.85;
  card(s, "panel", px, TOP, pw, ph);
  s.addText("Ask about this field", T({ objectName: "hdr", x: px + 0.3, y: TOP + 0.25, w: 3, h: 0.35, fontSize: 15, bold: true, color: C.background1 }));
  s.addText("What happens in a drought year?", T({ objectName: "q", shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: px + pw - 4.0 - 0.3, y: TOP + 0.85, w: 4.0, h: 0.55,
    fontSize: 15, color: C.text1, fill: { color: C.accent1 }, align: "center", valign: "middle" }));
  const lines = V.strategies.map((x, i) => {
    const wi = x.median.indexOf(Math.min(...x.median));
    const v = x.median[wi];
    return `${["Current", "Strategy A", "Strategy B", "Strategy C"][i]}: worst year ${x.years[wi]}, ${v < 0 ? "minus " : ""}$${Math.abs(Math.round(v))} per hectare`;
  });
  s.addText(`${lines.join("; ")}. This is a model comparison for your agronomist to check, not a recommendation.`,
    T({ objectName: "a", shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.12, x: px + 0.3, y: TOP + 1.65, w: pw - 0.9, h: 2.25, fontSize: 15,
      color: C.background1, fill: { color: "1A2035" }, margin: 0.18, valign: "top" }));
  const g = [
    ["Ranges, never promises", "Profit runs from a 1-in-10 bad year to a 1-in-10 good one."],
    ["Hypotheses, not advice", "Every rotation carries its risk, written for the agronomist."],
    ["Only computed numbers", "The assistant answers from the model's results and invents nothing."],
  ];
  const x = 7.45, w = 5.28;
  g.forEach(([h, t], i) => {
    const y = TOP + 0.1 + i * 1.6;
    s.addShape(pres.shapes.OVAL, { objectName: `gc${i}`, x, y, w: 0.6, h: 0.6, fill: { color: C.text1 }, line: { color: HEX.yellow, width: 1.5 } });
    s.addText(String(i + 1), T({ objectName: `gn${i}`, x, y, w: 0.6, h: 0.6, align: "center", valign: "middle", fontSize: 18, bold: true, color: C.accent1 }));
    s.addText([{ text: h, options: { fontSize: 18, bold: true, color: C.background1, breakLine: true } }, { text: t, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `gt${i}`, x: x + 0.85, y, w: w - 0.85, h: 1.3, valign: "top", paraSpaceAfter: 4 }));
  });
  s.addNotes("The assistant in the corner of the app answers in plain words, in English or Russian, from the precomputed results only. It never invents a number and always hands the decision back to the farmer and the agronomist.");
  anim(s, [{ fx: "fade", names: ["panel", "hdr"], dur: 400 }, { fx: "rise", names: ["q"], dur: 400 }, { fx: "rise", names: ["a"], dur: 500 },
    ...[0, 1, 2].map((i) => ({ fx: "rise", names: [`gc${i}`, `gn${i}`, `gt${i}`], dur: 400, gap: i ? -200 : 0 }))]);
}

// 15 ─ close ──────────────────────────────────────────────────────
{
  const s = slide(null, null, null, "Starfield blank");
  s.addImage({ path: B("planet.png"), objectName: "planet", x: 1.17, y: 4.35, w: 11, h: 11, altText: "East Kazakhstan fields seen by MODIS, wrapped on a globe" });
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 0.75, w: CW, h: 1.1, fontSize: 72, bold: true, color: C.accent1, align: "center", charSpacing: 6, fontFace: THEME.headFontFace, glow: { size: 12, opacity: 0.35, color: HEX.yellow } }));
  s.addText("It shows what each choice would have cost and kept.", T({ objectName: "l1", x: M, y: 2.05, w: CW, h: 0.6, fontSize: 28, color: C.background1, align: "center" }));
  s.addText("The farmer decides.", T({ objectName: "l2", x: M, y: 2.7, w: CW, h: 0.6, fontSize: 28, color: C.accent1, align: "center" }));
  s.addText("React + TypeScript · MapLibre · Recharts · Python: numpy, pymoo, h3 · a static site with no backend", T({ objectName: "stack", x: M, y: 3.55, w: CW, h: 0.4, fontSize: 14, color: C.background2, align: "center" }));
  s.addNotes("Furrow does not tell a farmer what to plant. It shows what each choice would have cost and kept. Built on NASA data, open source.");
  anim(s, [{ fx: "rise", names: ["planet"], dur: 1500, dy: 0.25 }, { fx: "zoom", names: ["logo"], dur: 700, gap: -600 }, { fx: "fade", names: ["l1"], dur: 600 }, { fx: "fade", names: ["l2"], dur: 600 }, { fx: "fade", names: ["stack"], dur: 500 }]);
  TRANS[s._n] = "fade";
}

(async () => {
  const out = B("furrow.pptx");
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(B("anim.json"), JSON.stringify({ anim: ANIM, trans: TRANS, theme: THEME }));
  console.log("wrote", out, n, "slides");
})();
