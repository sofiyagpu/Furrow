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

// 1 ─ opening crawl, 60 s, moves on by itself ─────────────────────
{
  const s = slide("Opening", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("crawl.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("stars.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "crawl" });
  s.addNotes("0:00–1:00. Read the crawl aloud as it scrolls, at a calm pace. It plays on its own and moves to the next slide when it ends. It carries the problem and why it matters now: shifting seasons, bare fields, soil blowing away in Kazakhstan, an aquifer draining in Arizona, and farmers without proof from their own field.");
  ANIM[s._n] = [{ media: "crawl", dur: 60000 }];
  TRANS[s._n] = "fade";
  ADV[s._n] = 60300;
}

// 2 ─ the app (≈20 s) ─────────────────────────────────────────────
{
  const s = slide("Product", "EPISODE I  ·  THE APP", "Pick a field on the map: every hexagon carries NASA data");
  anim(s, screens(s, "vko_hero", "vko_map", "left", [
    [`${V.cells} + ${AZ.cells} cells`, "in East Kazakhstan and Arizona, about 250 km² each"],
    ["22 seasons", "of NASA POWER daily weather per cell, with SoilGrids soil"],
    ["4 NASA layers", "MODIS NDVI, SMAP, GPM IMERG and GRACE-FO under the map"],
  ]));
  s.addNotes("1:00–1:20. This is Furrow. Pick a cell on the map: each carries its own soil and 22 years of NASA POWER weather, with NASA GIBS layers underneath. SMAP is 9 km, so the app never calls it your field's moisture.");
}

// 3 ─ rotations and the time machine (≈20 s) ──────────────────────
{
  const s = slide(null, "EPISODE II  ·  THE TIME MACHINE", "Four rotations, replayed over 22 real seasons");
  const cur = S(V, "current"), c = S(V, "C");
  anim(s, screens(s, "vko_strategies", "vko_time", "right", [
    ["4 rotations", "today's practice and three hypotheses, each with its risk written out"],
    [`${Math.round(cur.m.loss_years * 100)}% → ${Math.round(c.m.loss_years * 100)}%`, "of seasons losing money: wheat, wheat, fallow against wheat, chickpea, millet"],
    ["2008", "the drought year, replayed day by day in the root zone"],
  ]));
  s.addNotes("1:20–1:40. Four rotations as cards, each a hypothesis for the agronomist with its risk. The time machine replays every season since 2002 on this field's weather. Slide to 2008: every rotation suffers, but wheat, chickpea, millet stays positive.");
}

// 4 ─ what if (≈20 s) ─────────────────────────────────────────────
{
  const s = slide(null, "EPISODE III  ·  WHAT IF", "Warm the climate, then search hundreds of rotations");
  const cur = S(V, "current"), c = S(V, "C");
  anim(s, screens(s, "vko_tradeoffs", "vko_twin", "left", [
    [`${usd(c.twin)} vs ${usd(cur.twin)}`, "median per hectare at +2 °C and 10% less rain: rotation C against today"],
    [`${V.pareto} of ${V.searched}`, "rotations NSGA-II found that nothing beats on every count"],
    ["Your limits", "the most soil you will lose, the worst year you can take: the list keeps what fits"],
  ]));
  s.addNotes("1:40–2:00. The climate twin replays the same record two degrees warmer and ten percent drier: today's rotation goes negative. The trade-off cockpit searched hundreds of rotations; the farmer sets limits and the list keeps only what fits.");
}

// 5 ─ Arizona: water (≈15 s) ──────────────────────────────────────
{
  const s = slide(null, "EPISODE IV  ·  THE AQUIFER", "In Arizona the question is water left in the ground");
  const a = S(AZ, "A"), cur = S(AZ, "current"), c = S(AZ, "C");
  anim(s, screens(s, "az_map", "az_carbon", "right", [
    [`+${usd(a.m.profit[1] - cur.m.profit[1])}/ha`, "median profit for durum and guar on drip against cotton, durum, fallow"],
    [`−${Math.round(a.water_saved)} mm`, "of groundwater pumped a year by the same rotation"],
    [`${cur.m.bare_days} → ${a.m.bare_days} days`, "of bare soil a year through the dust season"],
  ]));
  s.addNotes(`2:00–2:15. Switch the region to Pinal County. Durum and guar on drip earns more and pumps less than today. Winter-only grain leaves ${Math.round(c.water_saved)} mm a year in the aquifer but needs water-saving payments. The carbon and water budget scales it to the whole farm.`);
}

// 6 ─ assistant (≈15 s) ───────────────────────────────────────────
{
  const s = slide("Close", "EPISODE V  ·  THE FARMER DECIDES", "An assistant that only quotes the model");
  const mw = 7.2, mh = mw / ASPECT.vko_hero, pw = 3.0, ph = pw / ASPECT.agent;
  s.addShape(pres.shapes.RECTANGLE, { objectName: "pagef", x: M - 0.02, y: TOP - 0.02, w: mw + 0.04, h: mh + 0.04, fill: { color: "161616" }, line: { color: HEX.line, width: 1 } });
  s.addImage({ path: B("app_vko_hero.jpg"), objectName: "page", x: M, y: TOP, w: mw, h: mh, transparency: 45, altText: "Furrow app page" });
  s.addShape(pres.shapes.RECTANGLE, { objectName: "panelf", x: M + mw - pw + 0.4 - 0.02, y: TOP + 0.25 - 0.02, w: pw + 0.04, h: ph + 0.04, fill: { color: "1B1B1B" }, line: { color: HEX.line, width: 1 }, shadow: shadow() });
  s.addImage({ path: B("app_agent.jpg"), objectName: "panel", x: M + mw - pw + 0.4, y: TOP + 0.25, w: pw, h: ph, altText: "Field assistant answering a drought question and a carbon question" });
  const g = [["Ranges, never promises", "Profit runs from a 1-in-10 bad year to a 1-in-10 good one."],
    ["Hypotheses, not advice", "Every rotation carries its risk, written for the agronomist."],
    ["Only computed numbers", "Answers in plain words, by text or voice, from the model's results."]];
  const x = 8.95, w = 3.78;
  g.forEach(([h, t], i) => s.addText([{ text: h, options: { fontSize: 18, bold: true, color: C.accent1, breakLine: true } }, { text: t, options: { fontSize: 14, color: C.background2 } }],
    T({ objectName: `g${i}`, x, y: TOP + i * 1.62, w, h: 1.35, valign: "top", paraSpaceAfter: 4 })));
  s.addNotes("2:15–2:30. The assistant answers by text or voice from the computed results only, never inventing a number, and always hands the decision back to the farmer and the agronomist.");
  anim(s, [{ fx: "fade", names: ["pagef", "page"], dur: 500 }, { fx: "rise", names: ["panelf", "panel"], dur: 700, dy: 0.5 },
    { fx: "fade", names: ["g0", "g1", "g2"], dur: 400, stagger: 250 }]);
}

// 7 ─ engine and ML (≈15 s) ───────────────────────────────────────
{
  const s = slide("Models", "EPISODE VI  ·  THE ENGINE", "Simple models now, a satellite ML layer next");
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
  s.addNotes("2:30–2:45. The models are small and replaceable. The ML repository already pulls Harmonized Landsat scenes from NASA Earthdata with a cloud filter and a size guard; features and the classifier are next, and they plug into the map through a JSON contract per cell.");
  anim(s, [{ fx: "fade", names: ["lbg", "lt"], dur: 500 }, { fx: "fade", names: ["rbg", "rh"], dur: 400 },
    ...[0, 1, 2, 3, 4].map((i) => ({ fx: "rise", names: [`mc${i}`, `mt${i}`], dur: 300, gap: i ? -150 : 0 })), { fx: "fade", names: ["out", "lim"], dur: 400 }]);
}

// 8 ─ close: the Earth turning (≈15 s, loops) ─────────────────────
{
  const s = slide(null, null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("globe.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("globe_poster.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "globe" });
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 2.0, w: 6.2, h: 1.1, fontSize: 72, color: C.accent1, charSpacing: 6, fontFace: THEME.headFontFace }));
  s.addText("It shows what each choice would have cost and kept.", T({ objectName: "l1", x: M, y: 3.3, w: 5.6, h: 1.0, fontSize: 26, color: C.background1, valign: "top" }));
  s.addText("The farmer decides.", T({ objectName: "l2", x: M, y: 4.45, w: 5.6, h: 0.55, fontSize: 26, color: C.accent1 }));
  s.addText("Built on NASA data  ·  NASA Space Apps 2026", T({ objectName: "l3", x: M, y: 5.35, w: 5.6, h: 0.4, fontSize: 14, color: C.background2 }));
  s.addNotes("2:45–3:00. Furrow does not tell a farmer what to plant. It shows what each choice would have cost and kept. The farmer decides.");
  anim(s, [{ media: "globe", dur: 20000, loop: true }, { fx: "zoom", names: ["logo"], dur: 800, gap: 300 }, { fx: "fade", names: ["l1"], dur: 600 }, { fx: "fade", names: ["l2"], dur: 600 }, { fx: "fade", names: ["l3"], dur: 500 }]);
  TRANS[s._n] = "fade";
}

(async () => {
  const out = B("furrow.pptx");
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(B("anim.json"), JSON.stringify({ anim: ANIM, trans: TRANS, adv: ADV, theme: THEME }));
  console.log("wrote", out, n, "slides");
})();
