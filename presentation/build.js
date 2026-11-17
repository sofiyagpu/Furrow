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
    // NASA Space Apps 2026 default logo, official file from spaceappschallenge.org/brand
    { image: { x: 13.333 - M - 1.4, y: 0.22, w: 1.4, h: 1.4 * 600 / 1527, path: path.join(__dirname, "img/spaceapps_logo.png"), altText: "NASA Space Apps Challenge" } },
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.42, w: CW, h: 0.36, fontSize: 13, bold: true,
      color: C.accent2, charSpacing: 4, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.8, w: CW, h: 0.95, fontSize: 34,
      color: C.accent1, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
});

const ANIM = {}; // slide number -> steps for animate.py
const TRANS = {};
const ADV = {}; // slide number -> auto-advance after ms
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

function stat(s, name, x, y, w, big, label, o = {}) {
  s.addText([
    { text: big, options: { fontSize: o.size || 34, color: o.color || C.accent1, fontFace: THEME.headFontFace, breakLine: true } },
    { text: label, options: { fontSize: o.labelSize || 14, color: C.background2 } },
  ], T({ objectName: name, x, y, w, h: o.h || 1.2, valign: "top", paraSpaceAfter: 2 }));
}
const usd = (v) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const shadow = () => ({ type: "outer", color: "000000", blur: 22, offset: 6, angle: 90, opacity: 0.7 });
function jpgSize(f) { // width, height from the JPEG SOF marker
  const b = fs.readFileSync(f);
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
}
const ASPECT = new Proxy({}, { get: (_, k) => { const [w, h] = jpgSize(B(`app_${k}.jpg`)); return w / h; } });

// Two live app screenshots, one laid over the other, and a column of three facts.
function screens(s, back, front, side, facts) {
  const tw = 3.55, gap = 0.45, area = CW - tw - gap;
  const ax = side === "left" ? M + tw + gap : M, tx = side === "left" ? M : M + area + gap;
  const bw = area * 0.8, bh = bw / ASPECT[back], fw = area * 0.64, fh = fw / ASPECT[front];
  const bx = side === "left" ? ax : ax + area - bw, fx = side === "left" ? ax + area - fw : ax;
  const fy = Math.min(7.0 - fh, TOP + bh - 0.6);
  const frame = (name, path_, x, y, w, h, sh) => {
    s.addShape(pres.shapes.RECTANGLE, { objectName: name + "f", x: x - 0.02, y: y - 0.02, w: w + 0.04, h: h + 0.04, fill: { color: "161616" }, line: { color: HEX.line, width: 1 }, shadow: sh ? shadow() : undefined });
    s.addImage({ path: B(`app_${path_}.jpg`), objectName: name, x, y, w, h, altText: `Furrow app: ${path_.replace("_", " ")}` });
  };
  frame("back", back, bx, TOP, bw, bh, false);
  frame("front", front, fx, fy, fw, fh, true);
  facts.forEach(([big, label], i) => stat(s, `f${i}`, tx, TOP + i * 1.62, tw, big, label, { size: 30, h: 1.45 }));
  return [{ fx: "zoom", names: ["backf", "back"], dur: 700 }, { fx: "rise", names: ["frontf", "front"], dur: 700, dy: 0.5 },
    { fx: "fade", names: facts.map((_, i) => `f${i}`), dur: 400, stagger: 250 }];
}

const chartBase = {
  catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, valGridLine: { color: HEX.grid, size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineColor: HEX.line, valAxisLineShow: false, legendColor: HEX.muted, legendFontFace: "+mn-lt", legendFontSize: 12,
  titleColor: "FFFFFF", titleFontFace: "+mn-lt", titleFontSize: 14, showTitle: true, dataLabelColor: "FFFFFF",
  dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11,
};
const QR_TEXT = "Scan to try Furrow"; // the code in img/qr.png opens https://myqrcode.mobi/860affa3
const NAMES = ["Current", "Strategy A", "Strategy B", "Strategy C"];
const ROT = [["Current", "wheat, wheat, black fallow"], ["A", "wheat, lentil, flax, wheat"], ["B", "wheat, pea, 2 years sainfoin"], ["C", "wheat, chickpea, millet"]];
const DOT = [C.accent3, C.accent4, C.accent5, C.accent6];

// 0 ─ title: a still frame, no builds ─────────────────────────────
{
  const s = slide("Title", null, null, "Starfield blank");
  s.background = { path: B("globe_poster.png") };
  s.addImage({ path: path.join(__dirname, "img/spaceapps_logo.png"), objectName: "sa", x: M, y: 0.55, w: 2.2, h: 2.2 * 600 / 1527, altText: "NASA Space Apps Challenge" });
  s.addText("NASA SPACE APPS 2026  ·  CHALLENGE", T({ objectName: "kick", x: M, y: 1.75, w: 6.3, h: 0.35, fontSize: 13, bold: true, color: C.accent2, charSpacing: 3, valign: "top" }));
  s.addText("Field Shift: Adapting Farms with NASA Data", T({ objectName: "case", x: M, y: 2.15, w: 6.3, h: 1.0, fontSize: 24, color: C.background1, valign: "top" }));
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 3.35, w: 7.0, h: 1.15, fontSize: 66, color: C.accent1, charSpacing: 3, fontFace: THEME.headFontFace, valign: "top", wrap: false }));
  s.addText("Crop rotation planner on NASA data", T({ objectName: "sub", x: M, y: 4.6, w: 6.3, h: 0.45, fontSize: 20, color: C.background1, valign: "top" }));
  s.addText([{ text: "TEAM  ", options: { color: C.background2, charSpacing: 4, fontSize: 13, bold: true } }, { text: "Rogue One", options: { color: C.accent1, fontSize: 22, bold: true } }],
    T({ objectName: "team", x: M, y: 5.55, w: 6.3, h: 0.55, valign: "middle" }));
  s.addNotes("0:00–0:10. Introduce the team and the challenge, then click: the crawl starts.");
  TRANS[s._n] = "fade";
}

// 1 ─ opening crawl with its soundtrack, 60 s, moves on by itself ──
{
  const s = slide("Opening", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("crawl.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("stars.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "crawl" });
  s.addNotes("0:10–1:10. Read the crawl aloud as it scrolls, at a calm pace; the music fades out as the story text comes in. It plays on its own and moves to the next slide when it ends.");
  ANIM[s._n] = [{ media: "crawl", dur: 60000 }];
  TRANS[s._n] = "fade";
  ADV[s._n] = 60300;
}

// 2 ─ the app: live screenshots (≈20 s) ───────────────────────────
{
  const s = slide("Product", "EPISODE I  ·  THE APP", "Pick a field, set what matters on your farm");
  anim(s, screens(s, "vko_map", "vko_strategies", "left", [
    [`${V.cells} + ${AZ.cells} cells`, "in East Kazakhstan and Arizona, each with its own soil and 22 years of NASA POWER weather"],
    ["Your priorities", "weigh profit, water, market and nitrogen; the best-fit rotation updates as you move them"],
    ["Ask the field", "an assistant that answers in plain words, in English or Russian"],
  ]));
  s.addNotes("1:10–1:28. This is Furrow. Pick a cell on the map: it carries its own soil and 22 years of NASA POWER weather, with NASA layers underneath. Set what matters on your farm, profit, water, market or nitrogen, and the best-fit rotation updates. The assistant answers from the results.");
}

// 3 ─ time machine: native chart (≈25 s) ──────────────────────────
{
  const s = slide(null, "EPISODE II  ·  THE TIME MACHINE", "Four rotations, replayed over 22 real seasons");
  const st = V.strategies;
  s.addChart(pres.charts.LINE, st.map((x, i) => ({ name: NAMES[i], labels: st[0].years.map(String), values: x.median })),
    { ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.9, h: 4.85, chartColors: SC, lineSize: 2.5, lineDataSymbol: "none",
      title: "Median profit per hectare by harvest year, East Kazakhstan", valAxisLabelFormatCode: "$#,##0;−$#,##0",
      showLegend: true, legendPos: "b", catAxisLabelFrequency: 2 });
  const x = 8.85, w = 3.88;
  ROT.forEach(([id, rot], i) => {
    const y = TOP + i * 0.92;
    s.addShape(pres.shapes.OVAL, { objectName: `d${i}`, x, y: y + 0.07, w: 0.2, h: 0.2, fill: { color: DOT[i] }, line: { type: "none" } });
    s.addText([{ text: `${id} · ${rot}`, options: { fontSize: 15, bold: true, color: C.background1, breakLine: true } },
      { text: `loses money in ${Math.round(st[i].m.loss_years * 100)}% of seasons`, options: { fontSize: 14, color: C.background2 } }],
      T({ objectName: `r${i}`, x: x + 0.35, y, w: w - 0.35, h: 0.8, valign: "top", paraSpaceAfter: 2 }));
  });
  const v08 = (z) => z.median[z.years.indexOf(2008)];
  s.addText([{ text: "2008 drought", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: `current practice ${usd(v08(S(V, "current")))}/ha, rotation C still ${usd(v08(S(V, "C")))}/ha`, options: { color: C.background1 } }],
    T({ objectName: "y08", x, y: TOP + 3.85, w, h: 0.9, fontSize: 15, valign: "top" }));
  s.addNotes("1:28–1:48. Today's rotation against three alternatives, each replayed over every season since 2002 on this field's weather. Wheat, wheat, fallow loses money in four seasons out of ten; wheat, chickpea, millet in one in fifty. In the 2008 drought every rotation dips, but C stays positive.");
  anim(s, [{ fx: "wipeR", names: ["chart"], dur: 1500 }, ...[0, 1, 2, 3].map((i) => ({ fx: "rise", names: [`d${i}`, `r${i}`], dur: 350, gap: i ? -200 : -900 })), { fx: "fade", names: ["y08"], dur: 400 }]);
}

// 4 ─ what if: native chart (≈25 s) ───────────────────────────────
{
  const s = slide(null, "EPISODE III  ·  WHAT IF", "Two degrees warmer, ten percent less rain");
  const st = V.strategies, labels = ["Current", "A", "B", "C"];
  s.addChart(pres.charts.BAR, [
    { name: "2002–2023 weather", labels, values: st.map((x) => x.today) },
    { name: "+2 °C, −10% rain", labels, values: st.map((x) => x.twin) },
  ], { ...chartBase, objectName: "chart", x: M, y: TOP, w: 7.6, h: 4.85, barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
    chartColors: [HEX.holo, HEX.red], title: "Median profit per hectare, East Kazakhstan", showValue: true, dataLabelPosition: "outEnd",
    dataLabelFormatCode: "$#,##0;−$#,##0", valAxisLabelFormatCode: "$#,##0;−$#,##0", showLegend: true, legendPos: "b" });
  const cur = S(V, "current"), c = S(V, "C"), x = 8.6, w = 4.13;
  stat(s, "s0", x, TOP, w, `${usd(c.twin)} vs ${usd(cur.twin)}`, "rotation C against today's practice in the warmer, drier climate", { size: 30, h: 1.45 });
  stat(s, "s1", x, TOP + 1.62, w, `${V.pareto} of ${V.searched}`, "rotations NSGA-II found that nothing beats on profit, bad years, soil and carbon at once", { size: 30, h: 1.45 });
  stat(s, "s2", x, TOP + 3.24, w, `r = ${V.smap.r.toFixed(2)}`, `model soil water against SMAP root-zone moisture on ${V.smap.n} dates; GPM IMERG rain keeps the same ranking`, { size: 30, h: 1.6 });
  const a = S(AZ, "A"), azc = S(AZ, "current");
  s.addNotes(`1:48–2:10. The climate twin replays the same record two degrees warmer and ten percent drier: today's rotation goes negative, C keeps most of its margin. The trade-off search scored ${V.searched} rotations and keeps the ${V.pareto} nothing beats. Checked against satellites: model soil water follows SMAP, and on GPM IMERG rain C still leads. In Arizona, durum and guar on drip earns ${usd(a.m.profit[1] - azc.m.profit[1])} more per hectare and pumps ${Math.round(a.water_saved)} mm less.`);
  anim(s, [{ fx: "wipeU", names: ["chart"], dur: 900 }, { fx: "rise", names: ["s0"], dur: 400 }, { fx: "rise", names: ["s1"], dur: 400 }, { fx: "rise", names: ["s2"], dur: 400 }]);
}

// 5 ─ the satellite eye: ML plan and first results (≈30 s) ─────────
{
  const s = slide("Models", "EPISODE IV  ·  THE SATELLITE EYE", "Field Shift ML: crop history from HLS satellite scenes");
  const ml = D.ml;
  // the plan, two branches that meet in one comparison
  const dw = 7.5, gx = 0.3, bw = (dw - gx) / 2, bh = 0.66, gy = 0.12;
  const rowY = (i) => TOP + i * (bh + gy);
  const nodes = [];
  const node = (name, x, y, w, title, sub, tone) => {
    s.addText([{ text: title, options: { fontSize: 13, bold: true, color: C.background1, breakLine: true } }, { text: sub, options: { fontSize: 10, color: C.background2 } }],
      T({ objectName: name, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w, h: bh, align: "center", valign: "middle", margin: 0.04,
        fill: { color: tone }, line: { color: HEX.line, width: 1 } }));
    nodes.push(name);
  };
  const arrow = (name, x1, y1, x2, y2) => {
    s.addShape(pres.shapes.LINE, { objectName: name, x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1) || 0.001, h: y2 - y1, flipH: x2 < x1,
      line: { color: HEX.muted, width: 1.25, endArrowType: "triangle" } });
  };
  const L = M, R = M + bw + gx, cx = M + dw / 2, lc = L + bw / 2, rc = R + bw / 2;
  const IN = "13294B", DONE = "0F3B2E", OUTC = "3A2A10";
  node("n0", M + dw * 0.14, rowY(0), dw * 0.72, `HLS L30 (${ml.dates} dates), CDL 2021 labels`, "CDL 2019–2020 field history", IN);
  node("l1", L, rowY(1), bw, "NDVI and clouds", "Fmask, dates over 50% cloud dropped", DONE);
  node("r1", R, rowY(1), bw, "Chips 224×224", `6 HLS bands, ${ml.dates_used} dates`, DONE);
  node("l2", L, rowY(2), bw, "RandomForest", "per-pixel classification", DONE);
  node("r2", R, rowY(2), bw, "Prithvi-EO-2.0", `fine-tuned on ${ml.dates_used} dates`, DONE);
  node("l3", L, rowY(3), bw, "Block CV 3×3", "buffer 30, 90, 150 px", DONE);
  node("r3", R, rowY(3), bw, "Same block CV", "same pixels as RandomForest", DONE);
  node("m4", M + dw * 0.2, rowY(4), dw * 0.6, "F1 by crop", "RandomForest against Prithvi, one sample", DONE);
  node("o5", L, rowY(5), bw, "Map and report", "CDL against prediction", DONE);
  node("f5", R, rowY(5), bw, "Export for Furrow", "752 plots of 0.7 km²: crop, 2019–2021 history, bare months", OUTC);
  const ar = [];
  const link = (n, x1, y1, x2, y2) => { arrow(n, x1, y1, x2, y2); ar.push(n); };
  link("a0", lc, rowY(1) - gy, lc, rowY(1)); link("a1", rc, rowY(1) - gy, rc, rowY(1));
  [1, 2].forEach((i) => { link(`al${i}`, lc, rowY(i) + bh, lc, rowY(i + 1)); link(`ar${i}`, rc, rowY(i) + bh, rc, rowY(i + 1)); });
  link("am", lc, rowY(3) + bh, cx - 0.4, rowY(4)); link("an", rc, rowY(3) + bh, cx + 0.4, rowY(4));
  link("ao", cx - 0.4, rowY(4) + bh, lc, rowY(5)); link("ap", cx + 0.4, rowY(4) + bh, rc, rowY(5));
  // first results: RandomForest, agricultural pixels
  const x = 8.45, w = 13.333 - M - x;
  const G = { fallow_idle: "Fallow", corn: "Corn", cotton: "Cotton", alfalfa: "Alfalfa", small_grains: "Small grains" };
  const keys = Object.keys(G).filter((k) => k in ml.f1);
  s.addChart(pres.charts.BAR, [{ name: "F1", labels: keys.map((k) => G[k]), values: keys.map((k) => ml.f1[k]) }],
    { ...chartBase, objectName: "f1", x, y: TOP, w, h: 2.55, barDir: "bar", barGapWidthPct: 45, chartColors: [HEX.B],
      title: "F1 by crop, RandomForest + field history", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00",
      valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: "0.0", showLegend: false, catAxisOrientation: "maxMin" });
  stat(s, "m0", x, TOP + 2.65, w, `${ml.accuracy.toFixed(2)} vs ${ml.baseline.toFixed(2)}`, "accuracy on farm pixels against always guessing the commonest class", { size: 26, h: 1.0 });
  s.addText([{ text: "RESULT", options: { fontSize: 11, bold: true, charSpacing: 2, color: C.accent1, breakLine: true } },
    { text: "Fine-tuned Prithvi-EO-2.0: 0.84, on par with RandomForest on the same images (0.86) and better on rare crops. Best: RandomForest + USDA field history, ", options: { fontSize: 14, color: C.background2 } },
    { text: ml.accuracy.toFixed(2), options: { fontSize: 14, bold: true, color: C.background1 } }],
    T({ objectName: "m1", x, y: TOP + 3.65, w, h: 1.4, valign: "top", paraSpaceAfter: 2 }));
  s.addNotes("2:10–2:40. Harmonized Landsat scenes from NASA Earthdata, USDA Cropland Data Layer as labels, over a 35 km window in Pinal County. A per-pixel random forest on NDVI and SWIR over 22 clear dates, plus whether each pixel was farmed in 2019 and 2020: 0.89 accuracy on farm pixels under 3×3 block cross-validation, F1 0.93 on fallow and 0.91 on corn. Prithvi-EO-2.0, fine-tuned on the same blocks, reaches 0.84 and does better on rare small grains. Furrow gets 752 field-scale plots with three years of history and bare months; in Kazakhstan, with no crop labels, it shows where cropland lay bare all summer.");
  anim(s, [{ fx: "fade", names: ["n0"], dur: 350 }, { fx: "fade", names: ["a0", "a1", "l1", "r1"], dur: 350 },
    { fx: "fade", names: ["al1", "ar1", "l2", "r2"], dur: 350 }, { fx: "fade", names: ["al2", "ar2", "l3", "r3"], dur: 350 },
    { fx: "fade", names: ["am", "an", "m4"], dur: 350 }, { fx: "fade", names: ["ao", "ap", "o5", "f5"], dur: 350 },
    { fx: "wipeR", names: ["f1"], dur: 800 }, { fx: "rise", names: ["m0"], dur: 400 }, { fx: "fade", names: ["m1"], dur: 400 }]);
}

// 6 ─ close: the Earth turning, and the link (≈15 s, loops) ────────
{
  const s = slide("Close", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("globe.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("globe_poster.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "globe" });
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 0.8, w: 7.0, h: 1.1, fontSize: 66, color: C.accent1, charSpacing: 3, fontFace: THEME.headFontFace, valign: "top", wrap: false }));
  s.addText("It shows what each choice would have cost and kept.", T({ objectName: "l1", x: M, y: 2.05, w: 5.6, h: 1.0, fontSize: 26, color: C.background1, valign: "top" }));
  s.addText("The farmer decides.", T({ objectName: "l2", x: M, y: 3.15, w: 5.6, h: 0.55, fontSize: 26, color: C.accent1 }));
  const q = 2.1, qy = 4.15;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: "qbg", x: M, y: qy, w: q, h: q, rectRadius: 0.1, fill: { color: "FFFFFF" }, line: { type: "none" } });
  s.addImage({ path: path.join(__dirname, "img/qr.png"), objectName: "qr", x: M + 0.12, y: qy + 0.12, w: q - 0.24, h: q - 0.24, altText: "QR code: open Furrow" });
  s.addText(QR_TEXT, T({ objectName: "qt", x: M + q + 0.3, y: qy + 0.05, w: 3.2, h: 0.45, fontSize: 16, color: C.accent2, valign: "top" }));
  s.addImage({ path: path.join(__dirname, "img/spaceapps_logo.png"), objectName: "sa", x: M + q + 0.3, y: qy + q - 2.2 * 600 / 1527, w: 2.2, h: 2.2 * 600 / 1527, altText: "NASA Space Apps Challenge" });
  s.addNotes("2:40–3:00. Furrow shows what each choice would have cost and kept, on real NASA data. Scan the code to try it on your field. The farmer decides.");
  anim(s, [{ media: "globe", dur: 20000, loop: true }, { fx: "zoom", names: ["logo"], dur: 800, gap: 300 }, { fx: "fade", names: ["l1"], dur: 500 }, { fx: "fade", names: ["l2"], dur: 500 },
    { fx: "zoom", names: ["qbg", "qr"], dur: 600 }, { fx: "fade", names: ["qt", "sa"], dur: 500, stagger: 200 }]);
  TRANS[s._n] = "fade";
}

(async () => {
  const out = B("furrow.pptx");
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(B("anim.json"), JSON.stringify({ anim: ANIM, trans: TRANS, adv: ADV, theme: THEME }));
  console.log("wrote", out, n, "slides");
})();
