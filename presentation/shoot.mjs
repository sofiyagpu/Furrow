// Screenshots of the live app for the deck, 1440x900 at 2x, through Chrome DevTools. Needs the app running:
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

const VIEWS = ["map", "strategies", "time", "climate", "tradeoffs", "carbon", "ml"];
async function open(url) {
  await cmd("Page.navigate", { url });
  await sleep(4500);
}
async function shot(name) {
  const { data } = await cmd("Page.captureScreenshot", { format: "jpeg", quality: 90 });
  writeFileSync(path.join(OUT, `app_${name}.jpg`), Buffer.from(data, "base64"));
  console.log("app_" + name);
}
const setRange = (sel, v) => js(`const el = document.querySelector('${sel}');
  if (el) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${v});
  el.dispatchEvent(new Event('input', { bubbles: true })); }`);

// the app is a dashboard now: one full-screen view per section, picked by the hash
for (const r of ["vko", "az"]) {
  for (const v of VIEWS) {
    await open(`${APP}?r=${r}#${v}`);
    if (v === "map") await sleep(3000); // imagery tiles
    if (v === "time") { await setRange("#time input[type=range]", r === "vko" ? 2008 : 2021); await sleep(700); }
    await shot(`${r}_${v}`);
  }
}

// the assistant, open over the map, with two answers
await open(`${APP}?r=vko#map`);
await sleep(3000);
await js(`document.querySelector('.agent-fab').click(); await new Promise(r=>setTimeout(r,400));
  for (const t of ['What about a drought year?', 'How much carbon?']) {
    [...document.querySelectorAll('.agent .chip')].find((c) => c.textContent === t)?.click();
    await new Promise(r=>setTimeout(r,300)); }
  speechSynthesis.cancel();`);
await sleep(800);
await shot("agent");

ws.close();
chrome.kill();
