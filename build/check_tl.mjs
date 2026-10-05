// Headless check for the Free Lebanon Data Hub (Chrome DevTools protocol, Node 22+, no deps).
// Usage: node check_tl.mjs <v5 dir or v5/lebanon-timeline.html> <out-dir>
// fetch() does not work over file://, so v5/ is served with python3 -m http.server on a free port (out-dir/site -> v5). Fixtures are copies of the shell with changed
// data (the data files are overlaid with symlinks). Plugin checks: build/checks/*.mjs, each `export default async function (T) { ... }` (see build/hub/README.md).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import net from 'node:net';

const [fileArg, outArg] = process.argv.slice(2).map(a => resolve(a));
const siteDir = /\.html$/.test(fileArg) ? dirname(fileArg) : fileArg, out = outArg;
mkdirSync(out, { recursive: true });
rmSync(join(out, 'site'), { force: true, recursive: true });
symlinkSync(siteDir, join(out, 'site'));
const SITE = 'site/lebanon-timeline.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort(), WEB = await freePort();
const prof = mkdtempSync(join(tmpdir(), 'tl-cdp-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  '--hide-scrollbars', '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const web = spawn('python3', ['-m', 'http.server', String(WEB), '--bind', '127.0.0.1', '--directory', out], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = () => { for (const p of [chrome, web]) { try { process.kill(p.pid); } catch (e) { /* gone */ } } };
setTimeout(() => { console.log('TIMEOUT'); kill(); process.exit(2); }, 7200000);   // 2 h: the plugin checks (a11y, perf, audit, shots) run after the 25 min core suite
let ws, id = 0; const waiters = {}, events = [];
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; waiters[i] = res; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); if (process.env.PROGRESS) console.log((pass ? 'pass ' : 'FAIL ') + name); };
const URL_OF = (rel, extra = '') => `http://127.0.0.1:${WEB}/${rel}${extra}`;

// opts: { query: '?lang=ar', hash: '#places', allow: /regex of expected network errors/, ready: false to skip the wait for the chart }
async function page(w, rel = SITE, opts = {}) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  for (const m of ['Runtime', 'Log', 'Page']) await send(m + '.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: w < 600 }, sessionId);
  const start = events.length;
  await send('Page.navigate', { url: URL_OF(rel, (opts.query || '') + (opts.hash || '')) }, sessionId);
  const ev = async expr => { const r = (await send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: expr }, sessionId)).result; return r ? r.value : undefined; };
  const wait = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { let v; try { v = await ev(expr); } catch (e) { v = false; } if (v) return true; await sleep(100); } return false; };
  if (opts.ready !== false) { await wait('document.readyState === "complete" && !!window.HUB && !!document.querySelector("#tl svg")', 30000); await sleep(350); }
  const VK = { Tab: 9, Escape: 27, Enter: 13, ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35 };
  const key = async k => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: VK[k] || 13 }, sessionId); };
  const shot = async name => writeFileSync(join(out, name), Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, sessionId)).data, 'base64'));
  const errors = (allow = opts.allow) => events.slice(start).filter(e => e.sessionId === sessionId && (e.method === 'Runtime.exceptionThrown' ||
    (e.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(e.params.type)) ||
    (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/fonts\.g|favicon/.test(e.params.entry.url || e.params.entry.text) && !(allow && allow.test((e.params.entry.url || '') + ' ' + e.params.entry.text)))))
    .map(e => e.method === 'Runtime.exceptionThrown' ? (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).slice(0, 200) : JSON.stringify(e).slice(0, 200));
  return { ev, wait, key, shot, errors, close: () => send('Target.closeTarget', { targetId }) };
}
const marks = 'document.querySelectorAll("#tl g.ev[data-id]").length';

// A copy of the built page for tests: `mutate(D)` changes the embedded core data (D), and `files` replaces or removes lazy data files:
// { 'portals/catalogue.json': '<text>' | () => '<text>' | null (the file is missing, so the fetch gets a 404) }. Everything else is a symlink to the real file.
function overlay(src, dst, files, prefix = '') {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const rel = prefix + e, hit = Object.keys(files).some(k => k === rel || k.startsWith(rel + '/'));
    if (Object.prototype.hasOwnProperty.call(files, rel)) continue;
    if (hit && statSync(join(src, e)).isDirectory()) overlay(join(src, e), join(dst, e), files, rel + '/');
    else symlinkSync(join(src, e), join(dst, e));
  }
  for (const [k, v] of Object.entries(files)) {
    if (!k.startsWith(prefix) || k.slice(prefix.length).includes('/') || v == null) continue;
    writeFileSync(join(dst, k.slice(prefix.length)), typeof v === 'function' ? v() : v);
  }
}
function fixture(name, mutate, files = {}) {
  const dir = join(out, 'fx', name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const html = readFileSync(join(siteDir, 'lebanon-timeline.html'), 'utf8'), re = /(<script type="application\/json" id="hubData">)([\s\S]*?)(<\/script>)/;
  const m = html.match(re), D = JSON.parse(m[2].replace(/<\\\//g, '</'));
  if (mutate) mutate(D);
  writeFileSync(join(dir, 'lebanon-timeline.html'), html.replace(re, (_, a, _b, c) => a + JSON.stringify(D).replace(/<\//g, '<\\/') + c));
  overlay(join(siteDir, 'data'), join(dir, 'data'), files);
  return `fx/${name}/lebanon-timeline.html`;
}
const readData = rel => JSON.parse(readFileSync(join(siteDir, 'data', rel), 'utf8'));
const TOPICS = ['population', 'economy', 'prices', 'labour', 'health'];
const fillFixture = D => {
  D.offices.push(['R:Emir', 'Fixture Emir II', '1788-01-01', '1840-10-13', 0, 'reported', null, 'fixture', 'x'], ['R:Emir', 'Fixture Emir III', '1840-10-13', '1860-01-01', 0, 'reported', null, '', 'x'],
    ['R:Qaimaqam', 'Fixture Qaimaqam', '1843-01-01', '1860-06-01', 0, 'reported', null, '', 'x'], ['R:Mutasarrif', 'Fixture Mutasarrif', '1861-06-09', '1868-01-01', 0, 'reported', null, '', 'x']);
  D.eras.push({ kind: 'period', start: '1800-01-01', end: '1860-06-01', label: 'Fixture emirate', c: 'reported', u: null, ongoing: false });
};
const fillFiles = () => {
  const portals = Array.from({ length: 130 }, (_, i) => [['odl', 'cas', 'cib'][i % 3], `Fixture dataset ${i}${i % 10 === 0 ? ' electricity' : ''}`, i === 1 ? 'مجموعة بيانات' : '', 'Fixture publisher', TOPICS[i % 5], '2010-2020', 'national', 'csv', `https://example.org/d/${i}`, 'CC BY 4.0', '2024-01-01', 'Fixture row, not real data']);
  const mo = Array.from({ length: 30 }, (_, i) => [`${2007 + Math.floor((i + 11) / 12)}-${String((i + 11) % 12 + 1).padStart(2, '0')}`, 76 + i * 1.5 + (i % 4)]);
  const series = [{ id: 'fx_cpi', label: 'Fixture CPI', unit: 'index', portal: 'cas', url: 'https://example.org/cpi', from: 2007, to: 2010, n: 30, notes: '', pts: mo },
    { id: 'fx_births', label: 'Fixture births', unit: 'count', portal: 'odl', url: 'https://example.org/births', from: 1999, to: 2003, n: 5, notes: '', pts: [['1999', 85955], ['2000', 87795], ['2001', 83693], ['2002', 76405], ['2003', 71702]] },
    { id: 'fx_lfs_unemployment', label: 'Fixture unemployment 2018', unit: 'percent', portal: 'odl', url: 'https://example.org/lfs', from: 2018, to: 2018, n: 1, notes: '', pts: [['2018', 11.35]] },
    { id: 'fx_flat', label: 'Fixture flat rate', unit: 'percent', portal: 'cas', url: 'https://example.org/flat', from: 2000, to: 2002, n: 3, notes: '', pts: [['2000', 5], ['2001', 5], ['2002', 5]] },
    { id: 'fx_old', label: 'Fixture series without points', unit: 'index', portal: 'cas', url: '', from: 1995, to: 2024, n: 30, notes: '' }];
  return { 'portals/catalogue.json': JSON.stringify({ cols: [], rows: portals }), 'portals/series.json': JSON.stringify({ series }) };
};
const emptyFiles = () => ({ 'portals/catalogue.json': JSON.stringify({ cols: [], rows: [] }), 'portals/series.json': JSON.stringify({ series: [] }) });
const hasSub = (e, s) => `String(${e}).includes(${JSON.stringify(s)})`;

// Plugin checks: build/checks/*.mjs, each `export default async function (T)`. T has ok, sleep, open(width, rel?, opts), fixture, readData, get, marks ...
// `--only hub,places` runs just those files (and none of the core checks): handy while you work on one tab.
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
async function plugins() {
  const T = { ok, sleep, open: (w, rel, o) => page(w, rel, o), page, fixture, readData, siteDir, out, SITE, WEB, URL_OF, marks, hasSub, checks, fillFiles, fillFixture, emptyFiles, get: rel => fetch(URL_OF('site/' + rel)) };
  const here = dirname(fileURLToPath(import.meta.url));
  for (const f of readdirSync(join(here, 'checks')).filter(x => x.endsWith('.mjs')).sort()) {
    if (ONLY.length && !ONLY.includes(f.replace(/\.mjs$/, ''))) continue;
    try { await (await import(pathToFileURL(join(here, 'checks', f)).href)).default(T); } catch (e) { ok('checks/' + f + ' ran to the end', false, String(e && e.stack || e).slice(0, 500)); }
  }
}

async function main() {
  let ver;
  for (let k = 0; k < 40 && !ver; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) { await sleep(250); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && waiters[d.id]) { waiters[d.id](d.result || d); delete waiters[d.id]; } else events.push(d); });
  if (ONLY.length && !ONLY.includes('core')) {   // --only=core runs the core checks below and only the plugins also named
    await plugins();
    for (const c of checks) console.log((c.pass ? 'PASS ' : 'FAIL ') + c.name + (c.detail != null && c.detail !== true ? '  [' + JSON.stringify(c.detail) + ']' : ''));
    console.log(checks.filter(c => !c.pass).length ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
    kill(); process.exit(checks.some(c => !c.pass) ? 1 : 0);
  }

  // ---- desktop 1400
  const p = await page(1400);
  const gone = await p.ev('["tlDetail","tlList","listH","claimNote","ansRail"].filter(i => document.getElementById(i)).concat(document.querySelector(".tl .cc,.tl .anc,.tl .ans-bg") ? ["answer row"] : [])');
  ok('removed elements absent (#tlDetail #tlList #listH #claimNote #ansRail, answer row)', gone.length === 0, gone);
  const n0 = await p.ev(marks);
  ok('event marks render', n0 > 50, n0);
  ok('nothing selected on load', await p.ev('!document.querySelector("#tl .sel") && document.getElementById("evCard").hidden'));
  ok('#tlLegend, #bandCtl, #presetNote, #yearCard, #fbar present', await p.ev('["tlLegend","bandCtl","presetNote","yearCard","fbar","q","tl"].every(i => document.getElementById(i))'));
  ok('answer lane text gone from chart', await p.ev('!/The answer/.test(document.getElementById("tl").textContent)'));
  await p.shot('shot-v5-tl-desktop.png');
  // search
  await p.ev('(() => { const q = document.getElementById("q"); q.value = "Taif"; q.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await sleep(1200);
  const n1 = await p.ev(marks);
  ok('typing "Taif" narrows the marks', n1 > 0 && n1 < n0, `${n0} -> ${n1}`);
  // clear, then preset
  await p.ev('document.querySelector("#activeF [data-rm=all]")?.click()');
  await sleep(600);
  ok('clearing the search removes the filter chips and widens the marks', (await p.ev('document.querySelectorAll("#activeF .fchip").length === 0')) && (await p.ev(marks)) > n1);
  await p.ev('document.querySelector("#presets [data-preset=assassinations]").click()');
  await sleep(1000);
  const n2 = await p.ev(marks);
  ok('a preset (Every assassination) applies', n2 > 0 && n2 !== n0 && await p.ev('!document.getElementById("presetNote").hidden'), `${n0} -> ${n2}`);
  await p.ev('document.querySelector("#activeF [data-rm=all]")?.click()');
  await sleep(600);
  // click an event
  const id0 = await p.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.focus(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); return g.dataset.id; })()');
  await sleep(700);
  ok('clicking an event opens the card', await p.ev('!document.getElementById("evCard").hidden && /Sources/.test(document.getElementById("evCard").textContent)'), id0);
  ok('card shows title, date and office holders', await p.ev('(() => { const t = document.getElementById("evCard").textContent; return !!document.querySelector("#evCard h4") && /In office/.test(t) && /Date/.test(t); })()'));
  ok('focus moved into the card', await p.ev('document.getElementById("evCard").contains(document.activeElement)'));
  await p.shot('shot-v5-tl-card.png');
  // chip inside the card applies a filter
  const chipTxt = await p.ev('(() => { const c = document.querySelector("#evCard .tchip"); if (!c) return null; const t = c.textContent; c.click(); return t; })()');
  await sleep(900);
  ok('a tchip in the card applies that filter', chipTxt && await p.ev('document.querySelectorAll("#activeF .fchip").length > 0 && document.getElementById("evCard").hidden'), chipTxt);
  await p.ev('document.querySelector("#activeF [data-rm=all]")?.click()');
  await sleep(600);
  // Esc closes and returns focus to the mark
  await p.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.focus(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()');
  await sleep(500);
  await p.key('Escape'); await sleep(300);
  ok('Esc closes the card', await p.ev('document.getElementById("evCard").hidden'));
  ok('focus returns to the mark', await p.ev('document.activeElement && document.activeElement.matches("#tl g[data-id]")'), await p.ev('document.activeElement.tagName + " " + (document.activeElement.dataset.id || "")'));
  // Enter on a mark opens, close button closes, outside click closes
  await p.ev('document.querySelector("#tl g.ev[data-id]").focus()');
  await p.key('Enter'); await sleep(500);
  ok('Enter on a mark opens the card', await p.ev('!document.getElementById("evCard").hidden'));
  await p.ev('document.querySelector("#evCard [data-evclose]").click()'); await sleep(300);
  ok('close button closes and refocuses the mark', await p.ev('document.getElementById("evCard").hidden && document.activeElement.matches("#tl g[data-id]")'));
  await p.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.focus(); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()');
  await sleep(500);
  await p.ev('document.querySelector(".tl-head h2").dispatchEvent(new MouseEvent("click", { bubbles: true }))'); await sleep(300);
  ok('click outside closes the card', await p.ev('document.getElementById("evCard").hidden'));
  // ranked marker
  await p.ev('document.querySelector("#zoomCtl [data-zoom=\\"20y\\"]").click()'); await sleep(600);
  const rk = await p.ev('(() => { const g = document.querySelector("#tl g.rk[data-id]"); if (!g) return null; g.dispatchEvent(new MouseEvent("click", { bubbles: true })); return g.dataset.id; })()');
  await sleep(600);
  ok('a ranked marker opens the card', rk && await p.ev('!document.getElementById("evCard").hidden && /Ranked/.test(document.getElementById("evCard").textContent)'), rk);
  await p.key('Escape'); await sleep(200);
  ok('page scrollWidth <= 1400 at desktop', (await p.ev('document.documentElement.scrollWidth')) <= 1400);
  const e1 = p.errors();
  ok('0 console errors (desktop)', e1.length === 0, e1);
  await p.close();

  // ---- mobile 390
  const m = await page(390);
  const sw = await m.ev('document.documentElement.scrollWidth');
  ok('390px: document.scrollWidth <= 390', sw <= 390, sw);
  ok('390px: event marks render', (await m.ev(marks)) > 20, await m.ev(marks));
  ok('390px: 16px side gutter', await m.ev('Math.round(document.getElementById("fbar").getBoundingClientRect().left) >= 16'), await m.ev('document.getElementById("fbar").getBoundingClientRect().left'));
  await m.shot('shot-v5-tl-mobile.png');
  await m.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()');
  await sleep(600);
  ok('390px: card opens and fits', await m.ev('(() => { const c = document.getElementById("evCard"); const r = c.getBoundingClientRect(); return !c.hidden && r.left >= 0 && r.right <= 390; })()'));
  ok('390px: scrollWidth still <= 390 with card open', (await m.ev('document.documentElement.scrollWidth')) <= 390);
  await m.shot('shot-v5-tl-mobile-card.png');
  const e2 = m.errors();
  ok('0 console errors (390px)', e2.length === 0, e2);
  await m.close();

  // ---- hub shell on the real page (1400)
  const h = await page(1400);
  ok('title is "Free Lebanon Data Hub"', (await h.ev('document.title')) === 'Free Lebanon Data Hub', await h.ev('document.title'));
  ok('h1 and eyebrow', (await h.ev('document.querySelector("h1")?.textContent')) === 'Free Lebanon Data Hub' && (await h.ev('document.querySelector(".hub-head .eyebrow")?.textContent')) === 'Lebanon, 1800 to 30 Sep 2026');
  const lead = await h.ev('document.querySelector(".hub-head .lead")?.textContent || ""');
  ok('lead is plain: short sentences, no em dash, says every item has a source', lead.length > 40 && !/[\u2014\u2013]/.test(lead) && /source/i.test(lead) && lead.split('.').every(x => x.split(' ').length < 25), lead);
  const nEv = await h.ev('JSON.parse(document.getElementById("hubData").textContent).events.length');
  const cnt = await h.ev('Object.fromEntries([...document.querySelectorAll("#hubCounts [data-count]")].map(e => [e.dataset.count, +e.textContent.replace(/,/g, "")]))');
  ok('live counts: events equal the data, sources > events/10, datasets and incidents are numbers', cnt.events === nEv && cnt.sources > 200 && Number.isInteger(cnt.datasets) && Number.isInteger(cnt.incidents), cnt);
  ok('tablist: 12 tabs, role=tablist, Timeline selected, one tab in the tab order', await h.ev('(() => { const t = [...document.querySelectorAll(".hub-tabs [role=tab]")]; return document.querySelector(".hub-tabs").getAttribute("role") === "tablist" && t.map(x => x.textContent).join() === "Timeline,Strike map,Places,Cost of living,Electricity,Trade & investment,World,Middle East,Companies,Aid & NGOs,Data,About" && t[0].getAttribute("aria-selected") === "true" && t.filter(x => x.tabIndex === 0).length === 1 && t.every(x => document.getElementById(x.getAttribute("aria-controls"))?.getAttribute("aria-labelledby") === x.id); })()'));
  ok('#timeline visible by default; #map #data #about hidden', await h.ev('!document.getElementById("timeline").hidden && ["map", "data", "about"].every(i => document.getElementById(i).hidden)'));
  await h.shot('shot-v6-hub-desktop.png');
  const tabState = async id => h.ev(`(() => { const t = document.getElementById("t-${id}"), p = document.getElementById("${id}"); return t.getAttribute("aria-selected") === "true" && !p.hidden && ["timeline", "map", "places", "cost", "electricity", "world", "data", "about"].filter(x => x !== "${id}").every(x => document.getElementById(x).hidden && document.getElementById("t-" + x).getAttribute("aria-selected") === "false"); })()`);
  for (const id of ['map', 'data', 'about', 'timeline']) {
    await h.ev(`document.getElementById("t-${id}").click()`); await sleep(350);
    ok(`click "${id}" tab: its panel shows, the others hide, hash is #${id}`, (await tabState(id)) && (await h.ev('location.hash')) === '#' + id, await h.ev('location.hash'));
  }
  ok('back on Timeline the chart re-renders', (await h.ev(marks)) > 50, await h.ev(marks));
  await h.ev('location.hash = "#about"'); await sleep(350);
  ok('setting the hash to #about opens About', await tabState('about'));
  ok('About: method, incomplete, cite, licences, "Built by Stephane Boghossian with Claude"', await h.ev('(() => { const t = document.getElementById("about").textContent; return /Built by Stephane Boghossian with Claude/.test(t) && /Jev/.test(t) && /What is incomplete/.test(t) && /How to cite/.test(t) && /CC BY-SA/.test(t) && /CC BY-IGO/.test(t) && /GeoNames/.test(t) && /OpenStreetMap/.test(t) && !/ACLED/.test(t) && !/\u2014/.test(t) && /Accessed \\d+ \\w+ \\d{4}/.test(document.getElementById("citeText").textContent); })()'));
  await h.ev('location.hash = "#nonsense"'); await sleep(350);
  ok('an unknown hash falls back to Timeline', await tabState('timeline'));
  await h.ev('document.getElementById("t-timeline").focus()');
  await h.key('ArrowRight'); await sleep(300);
  ok('ArrowRight moves focus to Strike map and opens it', (await tabState('map')) && (await h.ev('document.activeElement.id')) === 't-map', await h.ev('document.activeElement.id'));
  await h.key('End'); await sleep(300);
  ok('End goes to About; ArrowRight wraps to Timeline', (await tabState('about')) && (await h.key('ArrowRight'), await sleep(300), await tabState('timeline')));
  await h.ev('document.getElementById("t-map").click()'); await sleep(300);
  ok('#map has a section (FE2 fills #mapRoot)', await h.ev('!!document.querySelector("#map #mapRoot")'));
  const lang = await h.ev('document.documentElement.lang');
  ok('html lang is en', lang === 'en');
  await h.ev('document.getElementById("t-timeline").click()'); await sleep(300);
  // ---- v6 polish: the 1 year span, the weight default and the legend hint (real page, 1400)
  const zbtn = z => `document.querySelector("#zoomCtl [data-zoom=\\"${z}\\"]")`;
  const wOpt = () => h.ev('document.getElementById("weightCtl").options[0].textContent');
  ok('default span is 5 years (pressed), and the 1 year button is the first span button', (await h.ev(zbtn('5y') + '.getAttribute("aria-pressed")')) === 'true' && (await h.ev('document.querySelector("#zoomCtl button").dataset.zoom')) === '1y');
  ok('5 years: weight menu shows the default is "weight 2 and 3", with the other choices still listed', /weight 2 and 3/.test(await wOpt()) && (await h.ev('document.getElementById("weightCtl").value')) === '0' && (await h.ev('[...document.getElementById("weightCtl").options].map(o => o.value).join()')) === '0,1,2,3', await wOpt());
  ok('5 years: legend says only notable events are shown and where to get all of them', await h.ev('(() => { const l = document.getElementById("lgMore"); return !!l && /notable events/.test(l.textContent) && /choose .all events. for every item/.test(l.textContent) && !!l.querySelector("#lgAll"); })()'), await h.ev('document.getElementById("lgMore")?.textContent'));
  const n5 = await h.ev(marks);
  await h.ev('document.getElementById("lgAll").click()'); await sleep(900);
  const n5all = await h.ev(marks);
  ok('5 years: "Show all events" in the legend adds events, sets the menu to "all events" and drops the hint', n5all > n5 && (await h.ev('document.getElementById("weightCtl").value')) === '1' && (await h.ev('!document.getElementById("lgMore")')), [n5, n5all]);
  await h.ev('(() => { const w = document.getElementById("weightCtl"); w.value = "0"; w.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(900);
  ok('5 years: choosing "default for this view" restores the notable-only view', (await h.ev(marks)) === n5 && await h.ev('!!document.getElementById("lgMore")'), await h.ev(marks));
  await h.ev(zbtn('1y') + '.click()'); await sleep(1000);
  const nY1 = await h.ev(marks);
  ok('1 year: button pressed, chart has marks, svg label says "1 year"', (await h.ev(zbtn('1y') + '.getAttribute("aria-pressed")')) === 'true' && nY1 > 5 && (await h.ev('/1 year/.test(document.querySelector("#tl svg").getAttribute("aria-label"))')), nY1);
  ok('1 year: every mark is dated inside Oct 2025 to Sep 2026', await h.ev('(() => { const E = Object.fromEntries(JSON.parse(document.getElementById("hubData").textContent).events.map(e => [e.id, e])); const ids = [...document.querySelectorAll("#tl g.ev[data-id]")].map(g => E[g.dataset.id]).filter(Boolean); return ids.length > 5 && ids.every(e => e.t >= 2025.75 && e.t <= 2026.8); })()'));
  ok('1 year: the axis has quarter labels (Jan 2026, Apr 2026, Jul 2026) and no stray decade labels', await h.ev('(() => { const t = [...document.querySelectorAll("#tl text.ax")].map(x => x.textContent); return ["Jan 2026", "Apr 2026", "Jul 2026", "Oct 2025"].every(l => t.includes(l)) && !t.includes("1920"); })()'), await h.ev('[...new Set([...document.querySelectorAll("#tl text.ax")].map(x => x.textContent))].join()'));
  ok('1 year: the default is "all events" and the legend has no "notable events" hint', /all events/.test(await wOpt()) && (await h.ev('!document.getElementById("lgMore")')), await wOpt());
  await h.ev('window.scrollTo(0, 0)'); await h.shot('shot-v6-1y.png');
  await h.ev(zbtn('5y') + '.click()'); await sleep(700);
  ok('5 years again: the hint returns', await h.ev('!!document.getElementById("lgMore")'));
  // Data tab on the real page: one sparkline card per long-run series, grouped by topic
  await h.ev('document.getElementById("t-data").click()'); await sleep(500);
  await h.wait('document.querySelectorAll("#dSeries li.sp-card").length > 0', 8000);
  const ns = await h.ev('HUB.load("data/portals/series.json").then(o => o.series.length)');
  ok('Data (real): one card and one sparkline per long-run series, with a count line', ns > 20 && (await h.ev('document.querySelectorAll("#dSeries li.sp-card").length')) === ns && (await h.ev('document.querySelectorAll("#dSeries li.sp-card svg.sp path.sp-line").length')) >= ns - 6 && await h.ev('/\\d+ series in \\d+ topics/.test(document.getElementById("dSeriesCount").textContent)'), [ns, await h.ev('document.querySelectorAll("#dSeries li.sp-card").length')]);
  ok('Data (real): topics are sorted A to Z with "Other" last', await h.ev('(() => { const n = [...document.querySelectorAll("#dSeries h4.sp-topic")].map(x => x.firstChild.textContent.trim()); const b = n.filter(x => x !== "Other"); return b.join() === b.slice().sort((x, y) => x.localeCompare(y)).join() && (n.includes("Other") ? n[n.length - 1] === "Other" : true) && n.length >= 6; })()'), await h.ev('[...document.querySelectorAll("#dSeries h4.sp-topic")].map(x => x.firstChild.textContent.trim()).join()'));
  ok('Data (real): each card shows first and last value matching the data, the unit, the span and a source link', await h.ev('(async () => { const serNum = v => v.toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : 2 }), MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], serLab = k => /^\\d{4}-\\d{2}$/.test(k) ? MN[+k.slice(5) - 1] + " " + k.slice(0, 4) : String(k), PSER = (await HUB.load("data/portals/series.json")).series; const bad = []; document.querySelectorAll("#dSeries li.sp-card").forEach((li, i) => { const t = li.textContent; const s = PSER.find(x => li.querySelector(".d-t").textContent === x.label); if (!s) { bad.push("nomatch " + i); return; } const p = s.pts; if (!p.length) { bad.push("nopts " + s.id); return; } const dd = [...li.querySelectorAll(".sp-v dd")].map(x => x.textContent); const a = li.querySelector("a.sp-src"); if (dd[0] !== serNum(p[0][1]) || (p.length > 1 && dd[dd.length - 1] !== serNum(p[p.length - 1][1])) || !t.includes(serLab(p[0][0])) || !t.includes(serLab(p[p.length - 1][0])) || (s.unit && !t.includes(s.unit)) || !a || !/^https?:/.test(a.href) || a.target !== "_blank" || !/noopener/.test(a.rel)) bad.push(s.id); }); return bad.length ? bad.slice(0, 5).join() : true; })()'));
  ok('Data (real): a monthly series (CPI) reads "Dec 2007 to Aug 2026" and a yearly one (births) a year span', await h.ev('(() => { const c = [...document.querySelectorAll("#dSeries li.sp-card")]; const f = k => c.find(l => l.querySelector(".d-t").textContent.startsWith(k)); const a = f("Consumer Price Index, Lebanon"), b = f("Registered births"); return !!a && !!b && /Dec 2007 to Aug 2026/.test(a.textContent) && /1999 to 202\\d/.test(b.textContent); })()'));
  await h.ev('document.getElementById("dSeries").scrollIntoView()'); await sleep(200);
  await h.shot('shot-v6-data.png');
  await h.ev('document.getElementById("t-timeline").click()'); await sleep(400);

  // Since 1800 on the real page
  ok('zoom has "1 year" first and "Since 1800" last, and keeps the other four', await h.ev('[...document.querySelectorAll("#zoomCtl button")].map(b => b.textContent).join() === "1 year,5 years,20 years,Since 1950,100 years,Since 1800"'), await h.ev('[...document.querySelectorAll("#zoomCtl button")].map(b => b.textContent).join()'));
  await h.ev('document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]").click()'); await sleep(900);
  ok('Since 1800: chart renders, pressed, axis starts at 1800, no error', (await h.ev('document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]").getAttribute("aria-pressed")')) === 'true' && (await h.ev(marks)) > 50 && (await h.ev('/Since 1800/.test(document.querySelector("#tl svg").getAttribute("aria-label")) && [...document.querySelectorAll("#tl text.ax")].some(t => t.textContent === "1800") && [...document.querySelectorAll("#tl text.ax")].some(t => t.textContent === "2020")')), await h.ev(marks));
  ok('Since 1800: Rulers strip draws nothing and breaks nothing when there are no rulers (or draws them)', await h.ev('!!document.querySelector("#tl svg") && document.querySelectorAll("#tl rect.off-s.s-R").length >= 0'));
  const e1h = h.errors();
  ok('0 console errors (hub, 1400)', e1h.length === 0, e1h);
  ok('hub: page scrollWidth <= 1400', (await h.ev('document.documentElement.scrollWidth')) <= 1400);
  await h.close();

  // ---- fixtures: 1800 range with rulers, the Data tab filled, the Data tab empty
  const fxFull = fixture('full', fillFixture, fillFiles()), fxEmpty = fixture('empty', null, emptyFiles());
  const f = await page(1400, fxFull);
  ok('Rulers chip appears in the office-strips filter when rulers exist', await f.ev('(async () => { document.getElementById("moreBtn").click(); return !!document.querySelector("#stripCtl [data-strip=R]"); })()'));
  await f.ev('document.getElementById("moreBtn").click(); document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]").click()'); await sleep(900);
  ok('Since 1800 + rulers: Rulers strip shows each office, labelled "Rulers"', await f.ev('(() => { const r = document.querySelectorAll("#tl rect.off-s.s-R"); const l = [...document.querySelectorAll("#tl text.strip-l")].map(t => t.textContent); return r.length >= 4 && l.includes("Rulers") && [...r].every(x => !x.dataset.office) && [...r].filter(x => /Fixture (Emir|Qaimaqam|Mutasarrif)/.test(x.getAttribute("data-tip"))).length === 4; })()'), await f.ev('document.querySelectorAll("#tl rect.off-s.s-R").length'));
  ok('Since 1800 + pre-1920 era: the era strip draws it', await f.ev('[...document.querySelectorAll("#tl rect.era.k-period")].some(r => /Fixture emirate/.test(r.getAttribute("data-tip")))'));
  ok('Presidents strip stays empty (no data before 1920) without an error', await f.ev('!!document.querySelector("#tl svg")') && f.errors().length === 0, f.errors());
  await f.shot('shot-v6-1800.png');
  await f.ev('(() => { const w = document.getElementById("weightCtl"); w.value = "1"; w.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(900);
  const pre = await f.ev('(() => { const g = [...document.querySelectorAll("#tl g.ev[data-id]")].find(g => /_(18\\d\\d|190\\d|191\\d)-/.test(g.dataset.id)); if (!g) return null; g.dispatchEvent(new MouseEvent("click", { bubbles: true })); return g.dataset.id; })()');
  await sleep(600);
  ok('a pre-1920 event opens a card that lists rulers, not presidents', pre && await f.ev('(() => { const c = document.getElementById("evCard"); return !c.hidden && /In office/.test(c.textContent) && !/President|Prime minister|Speaker/.test(c.querySelector(".afs")?.textContent.split("in numbers")[0] || "") && /Fixture|no record in the rulers list/.test(c.textContent); })()'), pre);
  await f.key('Escape'); await sleep(200);
  // year card from the axis, 1850
  const yc = await f.ev(`(() => { const s = document.querySelector("#tl svg"), hit = s.querySelector(".ax-hit"), W = s.viewBox.baseVal.width, r = s.getBoundingClientRect(); const px = 156 + (1850.5 - 1800) / (2026.8 - 1800) * (W - 14 - 156); const o = { bubbles: true, clientX: r.left + px * (r.width / W), clientY: r.top + 10, pointerId: 1 }; hit.dispatchEvent(new PointerEvent("pointerdown", o)); hit.dispatchEvent(new PointerEvent("pointerup", o)); return true; })()`);
  await sleep(500);
  ok('tapping 1850 on the axis opens its year card with the rulers of that year', await f.ev('(() => { const c = document.getElementById("yearCard"); return !c.hidden && c.querySelector("h4").textContent === "1850" && /Rulers on 1 Jan 1850/.test(c.textContent) && /Fixture Emir III/.test(c.textContent) && /Fixture Qaimaqam/.test(c.textContent); })()'), await f.ev('document.getElementById("yearCard").textContent.slice(0, 160)'));
  ok('year card for 1850: previous is enabled, 1800 would disable it', await f.ev('!document.querySelector("#yearCard [data-ystep=\\"-1\\"]").disabled'));
  await f.ev('document.querySelector("#yearCard [data-yclose]").click()');
  await f.ev('document.getElementById("t-data").click()'); await sleep(500);
  const dc = async () => f.ev('document.getElementById("dCount").textContent');
  const rows = async () => f.ev('document.querySelectorAll("#dList li.d-row").length');
  const setQ = async v => { await f.ev(`(() => { const q = document.getElementById("dq"); q.value = ${JSON.stringify(v)}; q.dispatchEvent(new Event("input", { bubbles: true })); })()`); await sleep(400); };
  const setSel = async (id, v) => { await f.ev(`(() => { const q = document.getElementById("${id}"); q.value = ${JSON.stringify(v)}; q.dispatchEvent(new Event("change", { bubbles: true })); })()`); await sleep(300); };
  ok('Data tab with a catalogue: count line and first 60 rows', (await dc()) === '130 of 130 datasets' && (await rows()) === 60, await dc());
  ok('a row shows title, publisher, years, granularity, format and a link', await f.ev('(() => { const r = document.querySelector("#dList li.d-row"); const t = r.textContent; return /Fixture dataset 0/.test(t) && /Fixture publisher/.test(t) && /2010-2020/.test(t) && /national/.test(t) && /csv/i.test(t) && r.querySelector("a[href^=\\"https://\\"][target=_blank][rel*=noopener]"); })()'));
  ok('Arabic title renders with lang=ar and rtl', await f.ev('!!document.querySelector("#dList [lang=ar][dir=rtl]")'));
  await f.shot('shot-v6-data-catalogue.png');
  await f.ev('document.getElementById("dMore").click()'); await sleep(200);
  const r2 = await rows();
  await f.ev('document.getElementById("dMore").click()'); await sleep(200);
  ok('Show more adds rows until all 130 are shown, then hides', r2 === 120 && (await rows()) === 130 && (await f.ev('document.getElementById("dMore").hidden')), r2);
  await setQ('electricity');
  ok('search narrows (13 of 130)', (await dc()) === '13 of 130 datasets' && (await rows()) === 13, await dc());
  await setQ('zzzz');
  ok('no match gives a clear message', (await rows()) === 0 && await f.ev('/No dataset matches/.test(document.getElementById("dList").textContent)'));
  await setQ('');
  await setSel('dTopic', 'prices');
  ok('topic filter (26 of 130)', (await dc()) === '26 of 130 datasets', await dc());
  await setSel('dPortal', 'cib');
  const both = await dc();
  ok('topic + portal filters combine', /^\d+ of 130 datasets$/.test(both) && parseInt(both) > 0 && parseInt(both) < 26, both);
  await setSel('dTopic', ''); await setSel('dPortal', '');
  ok('clearing the filters restores 130', (await dc()) === '130 of 130 datasets');
  ok('Long-run series (fixture): 5 cards under Labour, Population, Prices and inflation, with Other last', await f.ev('(() => { const n = [...document.querySelectorAll("#dSeries h4.sp-topic")].map(x => x.firstChild.textContent.trim()); return n.join() === "Labour,Population,Prices and inflation,Other" && document.querySelectorAll("#dSeries li.sp-card").length === 5; })()'), await f.ev('[...document.querySelectorAll("#dSeries h4.sp-topic")].map(x => x.firstChild.textContent.trim()).join()'));
  ok('monthly series: first and last value, month span, unit, point count, source link', await f.ev('(() => { const l = [...document.querySelectorAll("#dSeries li")].find(x => /Fixture CPI/.test(x.textContent)); const t = l.textContent; return /Dec 2007 to May 2010/.test(t) && /30 points/.test(t) && /index/.test(t) && /First, Dec 2007/.test(t) && /Last, May 2010/.test(t) && l.querySelector("a.sp-src[href=\\"https://example.org/cpi\\"]") && !!l.querySelector("svg.sp path.sp-line") && l.querySelectorAll("svg.sp circle").length === 2; })()'), await f.ev('[...document.querySelectorAll("#dSeries li")].find(x => /Fixture CPI/.test(x.textContent)).textContent'));
  ok('yearly series: year span, first 85,955 and last 71,702', await f.ev('(() => { const l = [...document.querySelectorAll("#dSeries li")].find(x => /Fixture births/.test(x.textContent)); const d = [...l.querySelectorAll(".sp-v dd")].map(x => x.textContent); return /1999 to 2003/.test(l.textContent) && d.join("|") === "85,955|71,702"; })()'));
  ok('a one-point series draws one dot and says "Only value"; a flat series draws a straight line', await f.ev('(() => { const o = [...document.querySelectorAll("#dSeries li")].find(x => /unemployment 2018/.test(x.textContent)), fl = [...document.querySelectorAll("#dSeries li")].find(x => /flat rate/.test(x.textContent)); const ys = fl.querySelector("path.sp-line").getAttribute("d").match(/ ([\\d.]+)/g); return o.querySelectorAll("svg.sp circle").length === 1 && !o.querySelector("path.sp-line") && /Only value, 2018/.test(o.textContent) && new Set(ys).size === 1 ? true : [o.querySelectorAll("svg.sp circle").length, !!o.querySelector("path.sp-line"), o.textContent, fl.querySelector("path.sp-line").getAttribute("d")]; })()'));
  ok('a series with no points still lists its span, point count and shows no chart', await f.ev('(() => { const l = [...document.querySelectorAll("#dSeries li")].find(x => /without points/.test(x.textContent)); return /1995 to 2024/.test(l.textContent) && /30 points/.test(l.textContent) && !l.querySelector("svg") && /No source link/.test(l.textContent); })()'));
  ok('every sparkline has an accessible name that gives first and last value', await f.ev('[...document.querySelectorAll("#dSeries svg.sp")].every(s => s.getAttribute("role") === "img" && /^Fixture .*(from [\\d,.]+ in .* to [\\d,.]+ in|one value)/.test(s.getAttribute("aria-label")))'), await f.ev('document.querySelector("#dSeries svg.sp").getAttribute("aria-label")'));
  const e1f = f.errors();
  ok('0 console errors (fixtures, 1400)', e1f.length === 0, e1f);
  await f.close();
  const em = await page(1400, fxEmpty);
  await em.ev('document.getElementById("t-data").click()'); await sleep(400);
  ok('Data tab with no files: a clean empty state, no filters, no errors', await em.ev('!!document.getElementById("dEmpty") && !document.getElementById("dq") && !!document.getElementById("dSeriesEmpty") && !document.querySelector("#dList")') && em.errors().length === 0, em.errors());
  await em.close();

  // ---- hub at 390: every tab fits, 0 errors
  const hm = await page(390, fxFull);
  for (const id of ['timeline', 'map', 'places', 'cost', 'electricity', 'world', 'data', 'about']) {
    await hm.ev(`document.getElementById("t-${id}").click()`); await sleep(400);
    const sw2 = await hm.ev('document.documentElement.scrollWidth');
    ok(`390px: "${id}" tab: scrollWidth <= 390`, sw2 <= 390, sw2);
    if (id === 'data') await hm.shot('shot-v6-data-mobile.png');
  }
  ok('390px: the tab bar fits (all four tabs reachable, no page overflow)', await hm.ev('(() => { const n = document.querySelector(".hub-tabs"); const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= 390; })()'));
  await hm.ev('document.getElementById("t-data").click()'); await sleep(300);
  ok('390px: the Data tab series rows fit (v10: one list of every series; label, sparkline and links stay inside 390px)', await hm.wait('document.querySelectorAll("#dxSerL li.dx-sr").length >= 5', 15000) && await hm.ev('[...document.querySelectorAll("#dxSerL li.dx-sr")].slice(0, 30).every(l => [...l.querySelectorAll("svg, b, a, span")].every(e => e.getBoundingClientRect().width === 0 || (e.getBoundingClientRect().right <= 390.5 && e.getBoundingClientRect().left >= 0)))'), await hm.ev('document.querySelectorAll("#dxSerL li.dx-sr").length'));
  await hm.ev('document.getElementById("dxSer").scrollIntoView()'); await sleep(200);
  await hm.shot('shot-v6-data-series-mobile.png');
  ok('390px: Data tab rows fit', await hm.ev('(async () => { document.getElementById("t-data").click(); return [...document.querySelectorAll("#dList li, #dxSerL li")].every(l => l.getBoundingClientRect().right <= 390); })()'));
  await hm.ev('document.getElementById("t-timeline").click()'); await sleep(500);
  await hm.ev('document.querySelector("#zoomCtl [data-zoom=\\"1800\\"]").click()'); await sleep(900);
  ok('390px: Since 1800 renders marks, no overflow', (await hm.ev(marks)) > 20 && (await hm.ev('document.documentElement.scrollWidth')) <= 390);
  await hm.ev('window.scrollTo(0, 0)');
  await hm.shot('shot-v6-hub-mobile.png');
  const e3 = hm.errors();
  ok('0 console errors (hub, 390px)', e3.length === 0, e3);
  await hm.close();

  // ---- strike map (FE2): 1400
  const mp = await page(1400);
  await mp.ev('document.getElementById("t-map").click()'); await sleep(1500);
  const mapN = () => mp.ev('+document.querySelector("#mpStats [data-k=incidents]").dataset.n');
  const mapMode = () => mp.ev('document.getElementById("mpStage").dataset.mode');
  const clickWar = async id => { await mp.ev(`document.querySelector("#mpWar [data-war='${id}']").click()`); await sleep(500); };
  const clickPt = `(() => { const st = document.getElementById("mpStage"), c = document.querySelector("#mpPts circle"); if (!c) return null; const b = c.getBoundingClientRect(); const o = { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }; st.dispatchEvent(new PointerEvent("pointermove", o)); st.dispatchEvent(new MouseEvent("click", o)); return c.dataset.i; })()`;
  const nAll = await mapN();
  ok('map: renders N > 0 incidents, and the hub header count equals it', nAll > 0 && nAll === cnt.incidents, [nAll, cnt.incidents]);
  ok('map: coverage note says how many incidents are left out because their source does not confirm them', await mp.ev('(async () => { const n = (await HUB.load("data/strikes/strikes.json")).left_out; const e = document.getElementById("mpLeft"); return n > 0 && !!e && e.textContent.replace(/,/g, "").startsWith(n + " incidents are not shown because their cited source does not confirm them"); })()'), await mp.ev('document.getElementById("mpLeft")?.textContent'));
  ok('map: all wars draws on a canvas or hex bins when over 2,500 points, never an empty map', ['canvas', 'hex', 'svg'].includes(await mapMode()), await mapMode());
  if ((await mapMode()) === 'canvas') ok('map: the canvas has drawn pixels', await mp.ev('(() => { const c = document.getElementById("mpCv"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4000) if (d[i]) n++; return n > 20; })()'));
  ok('map: governorate labels and 26 district outlines', await mp.ev('document.querySelectorAll("#mpLb .mp-l1").length === 8 && document.querySelectorAll(".mp-d2 path").length === 26 && document.querySelectorAll(".mp-d1 path").length === 8'));
  ok('map: counts panel shows places, killed "as documented in sources", and top places', await mp.ev('(() => { const t = document.getElementById("mpStats").textContent; return /as documented in sources/i.test(t) && /Places/.test(t) && document.querySelectorAll("#mpTop li").length > 3; })()'));
  await clickWar('2006');
  ok('map: the left-out note stays the same under a war filter (it counts all wars)', await mp.ev('!!document.getElementById("mpLeft") && /all wars/.test(document.getElementById("mpLeft").textContent)'));
  const counts = {};
  for (const w of ['civil', '7882', '9396', '2006', '2326', 'other']) { await clickWar(w); counts[w] = await mapN(); }
  ok('map: each war selector changes the count and every war is smaller than All', Object.values(counts).every(n => n > 0 && n < nAll) && new Set(Object.values(counts)).size >= 5, counts);
  ok('map: the per-war counts add up to All', Object.values(counts).reduce((a, b) => a + b, 0) === nAll, [Object.values(counts).reduce((a, b) => a + b, 0), nAll]);
  await clickWar('civil');
  ok('map: civil war coverage note says what is complete and what is not', await mp.ev('/documented incidents only/i.test(document.getElementById("mpNote").textContent) && /no complete public record/i.test(document.getElementById("mpNote").textContent)'));
  await clickWar('2006');
  ok('map: a war with few points draws SVG circles, one per incident', (await mapMode()) === 'svg' && (await mp.ev('document.querySelectorAll("#mpPts circle").length')) === counts['2006'], [await mapMode(), counts['2006']]);
  const sel0 = await mp.ev(clickPt); await sleep(300);
  ok('map: hover shows a tooltip, click on a point opens the card with date, place, kind, toll, source and confidence', sel0 != null && await mp.ev('(() => { const c = document.getElementById("mapCard"), t = c.textContent; return !c.hidden && /Date/.test(t) && /Place/.test(t) && /Kind/.test(t) && /Toll/.test(t) && /Source/.test(t) && !!c.querySelector(".cf") && !!c.querySelector("a[href^=http]") && !document.getElementById("mpTip").hidden; })()'), sel0);
  ok('map: the selected dot is marked and focus moved into the card', await mp.ev('!!document.querySelector("#mpPts circle.sel") && document.getElementById("mapCard").contains(document.activeElement)'));
  await mp.shot('shot-v6-map-card.png');
  await mp.key('Escape'); await sleep(250);
  ok('map: Esc closes the card and returns focus to the map', await mp.ev('document.getElementById("mapCard").hidden && document.activeElement.id === "mpStage" && !document.querySelector("#mpPts circle.sel")'));
  await mp.ev('document.querySelector("#mpList [data-ri]").focus(); document.querySelector("#mpList [data-ri]").click()'); await sleep(250);
  ok('map: the incident list opens the same card from the keyboard path', await mp.ev('!document.getElementById("mapCard").hidden'));
  await mp.ev('document.querySelector("#mapCard [data-mapclose]").click()'); await sleep(200);
  ok('map: the close button closes and returns focus to the list item', await mp.ev('document.getElementById("mapCard").hidden && document.activeElement.matches("#mpList [data-ri]")'));
  // open in timeline
  const linked = await mp.ev(`(async () => { const bs = [...document.querySelectorAll("#mpList [data-ri]")]; for (const b of bs) { b.click(); if (document.querySelector("#mapCard [data-mapev]")) return true; } return false; })()`);
  let more = linked; if (!linked) { await mp.ev('document.getElementById("mpQ").value = "Qana"; document.getElementById("mpQ").dispatchEvent(new Event("input", { bubbles: true }))'); await sleep(500); more = await mp.ev(`(() => { for (const b of document.querySelectorAll("#mpList [data-ri]")) { b.click(); if (document.querySelector("#mapCard [data-mapev]")) return true; } return false; })()`); }
  if (more) {
    await mp.ev('document.querySelector("#mapCard [data-mapev]").click()'); await sleep(1000);
    ok('map: "Open in timeline" switches to the timeline and opens that event card', await mp.ev('location.hash === "#timeline" && !document.getElementById("timeline").hidden && !document.getElementById("evCard").hidden && /Sources/.test(document.getElementById("evCard").textContent)'), await mp.ev('location.hash'));
    await mp.key('Escape'); await mp.ev('document.getElementById("t-map").click()'); await sleep(600);
  } else ok('map: "Open in timeline" (no incident in this build matches a timeline event)', true, 'skipped');
  await mp.ev('document.getElementById("mpQ").value = ""; document.getElementById("mpQ").dispatchEvent(new Event("input", { bubbles: true }))'); await sleep(400);
  await clickWar('2326');
  const n23 = await mapN();
  await mp.ev('document.querySelector("#mpKinds [data-kind=airstrike]").click()'); await sleep(400);
  const nAir = await mapN();
  ok('map: a kind filter narrows the count', nAir > 0 && nAir < n23, [n23, nAir]);
  await mp.ev('document.querySelector("#mpKinds [data-kind=airstrike]").click()'); await sleep(300);
  await mp.ev('document.getElementById("mpQ").value = "Khiam"; document.getElementById("mpQ").dispatchEvent(new Event("input", { bubbles: true }))'); await sleep(500);
  const nK = await mapN();
  ok('map: place search narrows to that place, and top places lists it', nK > 0 && nK < n23 && await mp.ev('/Khiam/.test(document.getElementById("mpTop").textContent)'), [n23, nK]);
  await mp.ev('document.getElementById("mpQ").value = ""; document.getElementById("mpQ").dispatchEvent(new Event("input", { bubbles: true }))'); await sleep(400);
  const span = await mp.ev('[document.getElementById("mpT0").min, document.getElementById("mpT0").max]');
  await mp.ev('(() => { const a = document.getElementById("mpT0"), b = document.getElementById("mpT1"); a.value = "2024-09-01"; b.value = "2024-11-30"; a.dispatchEvent(new Event("change", { bubbles: true })); })()'); await sleep(500);
  const nT = await mapN();
  ok('map: the time range narrows the count and marks the histogram brush', nT > 0 && nT < n23 && await mp.ev('!!document.querySelector("#mpHist .mp-brush")'), [n23, nT, span]);
  await mp.ev('document.getElementById("mpTR").click()'); await sleep(400);
  ok('map: "Whole period" restores the count', (await mapN()) === n23);
  const hb = await mp.ev('(() => { const s = document.querySelector("#mpHist svg").getBoundingClientRect(); return [s.left, s.top, s.width, s.height]; })()');
  await mp.ev(`(() => { const h = document.getElementById("mpHist"), o = (x, t) => new PointerEvent(t, { bubbles: true, clientX: x, clientY: ${hb[1] + 20}, pointerId: 1 }); h.dispatchEvent(o(${hb[0] + hb[2] * 0.6}, "pointerdown")); h.dispatchEvent(o(${hb[0] + hb[2] * 0.9}, "pointermove")); h.dispatchEvent(o(${hb[0] + hb[2] * 0.9}, "pointerup")); })()`); await sleep(500);
  ok('map: dragging on the histogram sets the range', await mp.ev('!!document.getElementById("mpT0").value') && (await mapN()) < n23, [await mapN(), n23]);
  await mp.ev('document.getElementById("mpTR").click()'); await sleep(300);
  await clickWar('all');
  await mp.ev('document.querySelector("#mpMode [data-mode=hex]").click()'); await sleep(500);
  ok('map: density mode draws hex bins and keeps the total', (await mapMode()) === 'hex' && (await mp.ev('document.querySelectorAll("#mpPts .mp-hex").length')) > 10 && (await mapN()) === nAll, [await mapMode(), await mapN()]);
  await mp.ev('(() => { const st = document.getElementById("mpStage"), b = st.getBoundingClientRect(); st.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); })()'); await sleep(300);
  ok('map: scrolling zooms in (the n in view drops or stays, no error)', (await mp.ev('+document.getElementById("mpStage").dataset.n')) <= nAll);
  await mp.ev('document.querySelector("#mpMode [data-mode=points]").click(); document.querySelector("#mpStage .mp-zoom [data-z=\\"0\\"]").click()'); await sleep(400);
  ok('map: Points + Reset returns to the canvas or SVG points', ['canvas', 'svg'].includes(await mapMode()));
  await mp.ev('document.querySelector("#mpMode [data-mode=auto]").click()'); await sleep(300);
  await mp.ev('document.getElementById("mpInf").click()'); await sleep(400);
  ok('map: the "inferred placements" switch removes those points', (await mapN()) < nAll, [await mapN(), nAll]);
  await mp.ev('document.getElementById("mpInf").click()'); await sleep(300);
  ok('map: no ACLED layer when D.acled is absent', await mp.ev('!document.getElementById("mpAcOn")'));
  await mp.ev('document.getElementById("mpStage").scrollIntoView(); window.scrollBy(0, -330)'); await sleep(300);
  await mp.shot('shot-v6-map-desktop.png');
  ok('map: page scrollWidth <= 1400', (await mp.ev('document.documentElement.scrollWidth')) <= 1400);
  const e1m = mp.errors();
  ok('0 console errors (map, 1400)', e1m.length === 0, e1m);
  await mp.close();

  // map fixtures: ACLED layer present, and no strike data at all
  const skFile = (mut) => () => { const sk = readData('strikes/strikes.json'); mut(sk); return JSON.stringify(sk); };
  const fxAc = fixture('acled', null, { 'strikes/strikes.json': skFile(sk => {
    const pl = sk.places.slice(0, 3);
    sk.left_out = 1;
    sk.acled = { attribution: 'Armed Conflict Location & Event Data (ACLED), acleddata.com. Fixture.', accessed: '2026-10-01', from: '2016-01-01', to: '2026-10-01', types: ['Air/drone strike'], places: pl.map(p => [p[0], p[3], p[1], p[2]]), rows: pl.flatMap((p, i) => [[i, '2024-01', 0, 5 + i, 1], [i, '2024-02', 0, 2, 0]]) };
  }) });
  const fxNone = fixture('nomap', D => { D.tabs.map.has = false; });
  const ac = await page(1400, fxAc);
  await ac.ev('document.getElementById("t-map").click()'); await sleep(1200);
  ok('map left out, one incident: singular wording', await ac.ev('/^1 incident is not shown because its cited source does not confirm it\./.test(document.getElementById("mpLeft")?.textContent || "")'), await ac.ev('document.getElementById("mpLeft")?.textContent'));
  ok('map ACLED: the toggle appears only when D.acled exists, and the attribution stays hidden until it is on', await ac.ev('!!document.getElementById("mpAcOn") && document.getElementById("mpAcNote").hidden'));
  await ac.ev('document.querySelector("#mpWar [data-war=\\"2006\\"]").click()'); await sleep(300);
  await ac.ev('document.getElementById("mpAcOn").click()'); await sleep(500);
  ok('map ACLED: with the layer on, the ACLED attribution shows and its rings are drawn', await ac.ev('!document.getElementById("mpAcNote").hidden && /ACLED/.test(document.getElementById("mpAcNote").textContent) && document.querySelectorAll("#mpAc circle.mp-ac").length === 3'));
  ok('map ACLED: 0 console errors', ac.errors().length === 0, ac.errors());
  await ac.close();
  const fxZero = fixture('leftzero', null, { 'strikes/strikes.json': skFile(sk => { sk.left_out = 0; }) });
  const lz = await page(1400, fxZero);
  await lz.ev('document.getElementById("t-map").click()'); await sleep(1200);
  ok('map with nothing left out: no left-out note, the map still draws, 0 errors', await lz.ev('!document.getElementById("mpLeft") && +document.getElementById("mpStage").dataset.n > 0') && lz.errors().length === 0, lz.errors());
  await lz.close();
  const nm = await page(1400, fxNone);
  await nm.ev('document.getElementById("t-map").click()'); await sleep(500);
  ok('map with no strike data: a clean empty state and no errors', await nm.ev('!!document.querySelector("#mapRoot .hub-empty") && !document.getElementById("mpStage")') && nm.errors().length === 0, nm.errors());
  await nm.close();

  // ---- strike map at 390
  const mm = await page(390);
  await mm.ev('document.getElementById("t-map").click()'); await sleep(1500);
  ok('390px map: scrollWidth <= 390', (await mm.ev('document.documentElement.scrollWidth')) <= 390, await mm.ev('document.documentElement.scrollWidth'));
  ok('390px map: stage, chips and controls fit the viewport', await mm.ev('(() => { const bad = [...document.querySelectorAll("#mapRoot .mp *")].filter(e => !e.closest("svg, canvas") && e.getBoundingClientRect().right > 391 && e.offsetParent !== null); return bad.length === 0 ? true : bad.slice(0, 3).map(e => e.className + ":" + Math.round(e.getBoundingClientRect().right)).join(); })()'));
  ok('390px map: the left-out note is visible and fits', await mm.ev('(() => { const e = document.getElementById("mpLeft"); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= 390.5 && e.offsetParent !== null; })()'));
  ok('390px map: points render', (await mm.ev('+document.getElementById("mpStage").dataset.n')) > 100);
  await mm.ev('document.querySelector("#mpWar [data-war=\\"2006\\"]").click()'); await sleep(500);
  await mm.ev('document.getElementById("mpStage").scrollIntoView()'); await sleep(300);
  const pt = await mm.ev(clickPt); await sleep(400);
  ok('390px map: tapping a point opens a card that fits', pt != null && await mm.ev('(() => { const c = document.getElementById("mapCard"), r = c.getBoundingClientRect(); return !c.hidden && r.left >= 0 && r.right <= 390; })()'));
  ok('390px map: scrollWidth still <= 390 with the card open', (await mm.ev('document.documentElement.scrollWidth')) <= 390);
  await mm.shot('shot-v6-map-mobile.png');
  await mm.key('Escape'); await sleep(200);
  ok('390px map: Esc closes the card', await mm.ev('document.getElementById("mapCard").hidden'));
  const e4 = mm.errors();
  ok('0 console errors (map, 390px)', e4.length === 0, e4);
  await mm.close();

  await plugins();
  for (const c of checks) console.log((c.pass ? 'PASS ' : 'FAIL ') + c.name + (c.detail != null && c.detail !== true ? '  [' + JSON.stringify(c.detail) + ']' : ''));
  console.log(checks.filter(c => !c.pass).length ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
  kill(); process.exit(0);
}
main().catch(e => { for (const c of checks) if (!c.pass) console.log('FAIL ' + c.name + '  [' + JSON.stringify(c.detail) + ']'); console.log('FAIL', e); kill(); process.exit(1); });
