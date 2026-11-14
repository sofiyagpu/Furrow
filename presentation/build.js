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

// 1 ─ opening crawl, 60 s, moves on by itself ─────────────────────
{
  const s = slide("Opening", null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("crawl.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("stars.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "crawl" });
  s.addNotes("0:00–1:00. Read the crawl aloud as it scrolls, at a calm pace. It plays on its own and moves to the next slide when it ends. It carries the problem and why it matters now: shifting seasons, bare fields, soil blowing away in Kazakhstan, an aquifer draining in Arizona, and farmers without proof from their own field.");
  ANIM[s._n] = [{ media: "crawl", dur: 60000 }];
  TRANS[s._n] = "fade";
  ADV[s._n] = 60300;
}

// 2 ─ the app: map and time machine (≈30 s) ───────────────────────
{
  const s = slide("Product", "EPISODE I  ·  THE APP", "Pick a field, replay four rotations over 22 real seasons");
  const cur = S(V, "current"), c = S(V, "C");
  anim(s, screens(s, "vko_map", "vko_time", "left", [
    [`${V.cells} + ${AZ.cells} cells`, "in East Kazakhstan and Arizona, each with its own soil and NASA POWER weather"],
    ["4 NASA layers", "MODIS NDVI, SMAP, GPM IMERG and GRACE-FO under the map"],
    [`${Math.round(cur.m.loss_years * 100)}% → ${Math.round(c.m.loss_years * 100)}%`, "of seasons losing money: wheat, wheat, fallow against wheat, chickpea, millet"],
  ]));
  s.addNotes("1:00–1:30. This is Furrow. Pick a cell on the map: each carries its own soil and 22 years of NASA POWER weather, with NASA layers underneath. Four rotations, today's and three hypotheses for the agronomist, are replayed over every season since 2002. In the 2008 drought every rotation suffers, but wheat, chickpea, millet stays positive.");
}

// 3 ─ what if (≈30 s) ─────────────────────────────────────────────
{
  const s = slide(null, "EPISODE II  ·  WHAT IF", "Warm the climate, then search hundreds of rotations");
  const cur = S(V, "current"), c = S(V, "C"), a = S(AZ, "A"), azc = S(AZ, "current");
  anim(s, screens(s, "vko_tradeoffs", "vko_twin", "right", [
    [`${usd(c.twin)} vs ${usd(cur.twin)}`, "median per hectare at +2 °C and 10% less rain: rotation C against today"],
    [`${V.pareto} of ${V.searched}`, "rotations NSGA-II found that nothing beats on every count"],
    [`+${usd(a.m.profit[1] - azc.m.profit[1])}, −${Math.round(a.water_saved)} mm`, "in Arizona: durum and guar on drip against today, per hectare, less groundwater pumped"],
  ]));
  s.addNotes("1:30–2:00. The climate twin replays the same record two degrees warmer and ten percent drier: today's rotation goes negative. The trade-off cockpit searched hundreds of rotations; the farmer sets limits and the list keeps only what fits. In Arizona the same tools answer the water question: the water-wise rotation earns more and pumps less.");
}

// 4 ─ the farmer decides (≈25 s) ───────────────────────────────────────────
{
  const s = slide("Close", "EPISODE III  ·  THE FARMER DECIDES", "An assistant that only quotes the model");
  const mw = 7.2, mh = mw / ASPECT.vko_hero, pw = 3.0, ph = pw / ASPECT.agent;
  s.addShape(pres.shapes.RECTANGLE, { objectName: "pagef", x: M - 0.02, y: TOP - 0.02, w: mw + 0.04, h: mh + 0.04, fill: { color: "161616" }, line: { color: HEX.line, width: 1 } });
  s.addImage({ path: B("app_vko_hero.jpg"), objectName: "page", x: M, y: TOP, w: mw, h: mh, transparency: 45, altText: "Furrow app page" });
  s.addShape(pres.shapes.RECTANGLE, { objectName: "panelf", x: M + mw - pw + 0.4 - 0.02, y: TOP + 0.25 - 0.02, w: pw + 0.04, h: ph + 0.04, fill: { color: "1B1B1B" }, line: { color: HEX.line, width: 1 }, shadow: shadow() });
  s.addImage({ path: B("app_agent.jpg"), objectName: "panel", x: M + mw - pw + 0.4, y: TOP + 0.25, w: pw, h: ph, altText: "Field assistant answering a drought question and a carbon question" });
  const g = [["Every number is a range", "Profit runs from a 1-in-10 bad year to a 1-in-10 good one."],
    ["Only computed numbers", "Answers in plain words, by text or voice, from the model's results."],
    ["Next: the satellite eye", "carver-ml pulls HLS Landsat scenes from NASA Earthdata; a per-field crop classifier is next."]];
  const x = 8.95, w = 3.78;
  g.forEach(([h, t], i) => s.addText([{ text: h, options: { fontSize: 18, bold: true, color: C.accent1, breakLine: true } }, { text: t, options: { fontSize: 14, color: C.background2 } }],
    T({ objectName: `g${i}`, x, y: TOP + i * 1.62, w, h: 1.5, valign: "top", paraSpaceAfter: 4 })));
  s.addNotes("2:00–2:25. The assistant answers by text or voice from the computed results and hands the decision back to the farmer and the agronomist. Every number is a range, and the models (FAO-56 water balance, RUSLE and wind erosion, RothC carbon, NSGA-II search) are small and replaceable. Next, the ML repository adds satellite crop history per field.");
  anim(s, [{ fx: "fade", names: ["pagef", "page"], dur: 500 }, { fx: "rise", names: ["panelf", "panel"], dur: 700, dy: 0.5 },
    { fx: "fade", names: ["g0", "g1", "g2"], dur: 400, stagger: 250 }]);
}

// 5 ─ close: the Earth turning (≈15 s, loops) ─────────────────────
{
  const s = slide(null, null, null, "Starfield blank");
  s.addMedia({ type: "video", path: B("globe.mp4"), cover: "data:image/png;base64," + fs.readFileSync(B("globe_poster.png")).toString("base64"), x: 0, y: 0, w: 13.333, h: 7.5, objectName: "globe" });
  s.addText("FURROW", T({ objectName: "logo", x: M, y: 2.0, w: 6.2, h: 1.1, fontSize: 72, color: C.accent1, charSpacing: 6, fontFace: THEME.headFontFace }));
  s.addText("It shows what each choice would have cost and kept.", T({ objectName: "l1", x: M, y: 3.3, w: 5.6, h: 1.0, fontSize: 26, color: C.background1, valign: "top" }));
  s.addText("The farmer decides.", T({ objectName: "l2", x: M, y: 4.45, w: 5.6, h: 0.55, fontSize: 26, color: C.accent1 }));
  s.addText("Built on NASA data", T({ objectName: "l3", x: M, y: 5.25, w: 5.6, h: 0.4, fontSize: 14, color: C.background2 }));
  s.addImage({ path: path.join(__dirname, "img/spaceapps_logo.png"), objectName: "sa", x: M, y: 5.85, w: 2.55, h: 2.55 * 600 / 1527, altText: "NASA Space Apps Challenge" });
  s.addNotes("2:25–2:40. Furrow shows what each choice would have cost and kept. The farmer decides.");
  anim(s, [{ media: "globe", dur: 20000, loop: true }, { fx: "zoom", names: ["logo"], dur: 800, gap: 300 }, { fx: "fade", names: ["l1"], dur: 600 }, { fx: "fade", names: ["l2"], dur: 600 }, { fx: "fade", names: ["l3", "sa"], dur: 500, stagger: 200 }]);
  TRANS[s._n] = "fade";
}

(async () => {
  const out = B("furrow.pptx");
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(B("anim.json"), JSON.stringify({ anim: ANIM, trans: TRANS, adv: ADV, theme: THEME }));
  console.log("wrote", out, n, "slides");
})();
