// Screenshots of the live app for the deck, at 2x, through Chrome DevTools. Needs the app running:
//   (cd ../web && npx vite --port 5199) ; node shoot.mjs   -> build/app_*.jpg
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const APP = process.env.APP || "http://localhost:5199/";
const OUT = path.join(import.meta.dirname, "build");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "deckshoot-"))}`,
  "--hide-scrollbars", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 40 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch { await sleep(250); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cmd = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => (await cmd("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true })).result.value;

await cmd("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

const HELPERS = `
  window.__set = (sel, i, v) => { const el = document.querySelectorAll(sel)[i];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__body = (id) => { const s = document.getElementById(id); s.scrollIntoView({ block: 'start' });
    const kids = [...s.querySelectorAll('.wrap > *')].filter((k) => !k.matches('h2, .lead, .eyebrow, p, .sec-head'));
    const rs = kids.map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
    const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)),
          r = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom));
    return { x: x - 16, y: y + scrollY - 16, width: r - x + 32, height: b - y + 32 }; };
`;
async function open(url) {
  await cmd("Page.navigate", { url });
  await sleep(4500);
  await js(HELPERS);
}
async function shot(name, clip) {
  const p = { format: "jpeg", quality: 90, captureBeyondViewport: !!clip };
  if (clip) p.clip = { ...clip, scale: 1 };
  const { data } = await cmd("Page.captureScreenshot", p);
  writeFileSync(path.join(OUT, `app_${name}.jpg`), Buffer.from(data, "base64"));
  console.log("app_" + name, clip ? `${Math.round(clip.width)}x${Math.round(clip.height)}` : "viewport");
}
const hideChrome = `document.querySelector('.nav').style.visibility='hidden';
  document.querySelectorAll('.agent-fab').forEach((b) => b.style.visibility='hidden');`;

for (const r of process.env.AGENT_ONLY ? [] : ["vko", "az"]) {
  await open(`${APP}?r=${r}`);
  await js("scrollTo(0,0)");
  await sleep(1500);
  await shot(`${r}_hero`);
  await js(hideChrome);
  for (const sec of ["map", "strategies", "time", "twin", "tradeoffs", "carbon"]) {
    const clip = await js(`return __body('${sec}')`);
    await sleep(sec === "map" ? 3500 : 900); // map tiles
    if (sec === "time") { await js(`__set('#time input[type=range]', 0, ${r === "vko" ? 2008 : 2021})`); await sleep(700); }
    await shot(`${r}_${sec}`, await js(`return __body('${sec}')`));
  }
}

// the assistant, open over the map, with two answers
await open(`${APP}?r=vko`);
await js("document.getElementById('map').scrollIntoView({block:'start'}); scrollBy(0,-70);");
await sleep(3500);
await js(`document.querySelector('.agent-fab').click(); await new Promise(r=>setTimeout(r,400));
  for (const t of ['What about a drought year?', 'How much carbon?']) {
    [...document.querySelectorAll('.agent .chip')].find((c) => c.textContent === t).click();
    await new Promise(r=>setTimeout(r,300)); }
  speechSynthesis.cancel();`);
await sleep(800);
await shot("agent", await js(`const a = document.querySelector('.agent');
  a.style.background = '#1b1b1b'; a.style.backdropFilter = 'none'; // the glass panel lets the page show through
  const r = a.getBoundingClientRect();
  return { x: r.left, y: r.top + scrollY, width: r.width, height: r.height }`));

ws.close();
chrome.kill();
