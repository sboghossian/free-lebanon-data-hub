// FE-D accessibility checks: tab and dialog semantics, keyboard order, visible focus, contrast in both themes, RTL mirroring. Writes a11y.json.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TABS = ['timeline', 'map', 'places', 'cost', 'electricity', 'world', 'data', 'about'];
// contrast: WCAG ratio of every visible text element against the colour that is really behind it (walks up to the first opaque background, blends alpha)
const CONTRAST = `(() => {
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = c => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat([1]);
  const lum = c => { const l = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * l[0] + .7152 * l[1] + .0722 * l[2]; };
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const b = rgba(getComputedStyle(e).backgroundColor); if (b[3] > 0) { stack.push(b); if (b[3] >= 1) break; } } let base = [255, 255, 255, 1]; if (!stack.length || stack[stack.length - 1][3] < 1) base = rgba(getComputedStyle(document.body).backgroundColor); if (base[3] < 1) base = [255, 255, 255, 1]; return stack.reduceRight((acc, b) => over(b, acc), base); };
  const out = [], seen = new Set(), root = document.querySelector('.panel:not([hidden]), .hub-panel:not([hidden])') || document.body;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n, k = 0;
  while ((n = w.nextNode()) && k < 4000) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.nodeValue.trim() || /^(SCRIPT|STYLE)$/.test(el.nodeName)) continue;
    seen.add(el); const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue; k++;
    const fg = rgba(cs.color), bg = bgOf(el), f = over(fg, bg), L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (px >= 18.66 && bold), need = large ? 3 : 4.5;
    if (ratio < need) out.push({ t: n.nodeValue.trim().slice(0, 40), cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 30), tag: el.nodeName, ratio: Math.round(ratio * 100) / 100, need, px });
  }
  return { checked: k, fails: out.slice(0, 40), n: out.length };
})()`;
const FOCUS = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const o = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, sh = cs.boxShadow && cs.boxShadow !== 'none';
  return { tag: e.nodeName.toLowerCase(), id: e.id, cls: String(e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 30), vis: o || sh, hidden: !!e.closest('[hidden]'), size: r.width * r.height, tabindex: e.getAttribute('tabindex'), label: (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().slice(0, 30) }; })()`;

export default async function (T) {
  const { ok, sleep, open } = T;
  const rep = {};
  const p = await open(1400, T.SITE, { query: '?lang=en' });
  // ---- tab semantics
  const sem = await p.ev(`(() => { const tl = document.querySelector('.hub-tabs'), tabs = [...tl.querySelectorAll('[role=tab]')];
    return { tablist: tl.getAttribute('role') === 'tablist' && !!tl.getAttribute('aria-label'), n: tabs.length,
      controls: tabs.every(t => { const p = document.getElementById(t.getAttribute('aria-controls')); return p && p.getAttribute('role') === 'tabpanel' && p.getAttribute('aria-labelledby') === t.id; }),
      one: tabs.filter(t => t.getAttribute('aria-selected') === 'true').length === 1, roving: tabs.filter(t => t.tabIndex === 0).length === 1,
      hiddenOthers: tabs.every(t => (document.getElementById(t.getAttribute('aria-controls')).hidden) === (t.getAttribute('aria-selected') !== 'true')) }; })()`);
  rep.semantics = sem;
  ok('a11y: tablist has a label, 8 tabs, each tab controls a tabpanel that points back to it', sem.tablist && sem.n === 8 && sem.controls, sem);
  ok('a11y: exactly one tab is selected and in the tab order (roving tabindex), the other panels are hidden', sem.one && sem.roving && sem.hiddenOthers, sem);
  await p.ev('document.getElementById("t-timeline").focus()');
  await p.key('ArrowRight'); await sleep(250);
  ok('a11y: ArrowRight moves to the next tab and selects it', await p.ev('document.activeElement.id === "t-map" && document.getElementById("t-map").getAttribute("aria-selected") === "true"'));
  await p.key('End'); await sleep(250);
  ok('a11y: End goes to the last tab, Home to the first', await p.ev('document.activeElement.id === "t-about"') && (await p.key('Home'), await sleep(250), await p.ev('document.activeElement.id === "t-timeline"')));
  // ---- dialogs
  const dl = await p.ev(`[...document.querySelectorAll('[role=dialog]')].map(d => ({ id: d.id, label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby'), hidden: d.hidden }))`);
  rep.dialogs = dl;
  ok('a11y: every dialog has an accessible name and starts hidden', dl.length >= 2 && dl.every(d => d.label && d.hidden), dl);
  await p.ev('(() => { const g = document.querySelector("#tl g.ev[data-id]"); g && g.dispatchEvent(new MouseEvent("click", { bubbles: true })); })()'); await sleep(600);
  const dopen = await p.ev('(() => { const c = document.getElementById("evCard"); return { open: !c.hidden, inside: c.contains(document.activeElement), tag: document.activeElement && document.activeElement.nodeName }; })()');
  rep.eventCard = dopen;
  ok('a11y: opening an event card moves focus into it', dopen.open && dopen.inside, dopen);
  await p.key('Escape'); await sleep(300);
  ok('a11y: Escape closes the event card and focus leaves it', await p.ev('document.getElementById("evCard").hidden && !document.getElementById("evCard").contains(document.activeElement)'));
  // ---- keyboard order and visible focus on every tab (real Tab presses)
  rep.focus = {};
  for (const tab of TABS) {
    await p.ev(`document.getElementById("t-${tab}").click()`); await sleep(tab === 'world' || tab === 'places' ? 3000 : 1500);
    await p.ev('document.getElementById("t-' + tab + '").focus()');
    const seen = []; let bad = [];
    for (let i = 0; i < 28; i++) {
      await p.key('Tab'); await sleep(40);
      const f = await p.ev(FOCUS);
      if (!f) continue; seen.push(f);
      if (!f.vis) bad.push(`${f.tag}#${f.id}.${f.cls} "${f.label}"`);
      if (f.hidden || f.size === 0) bad.push(`HIDDEN ${f.tag}#${f.id} "${f.label}"`);
      if (f.tabindex && +f.tabindex > 0) bad.push(`POSITIVE tabindex ${f.tag}#${f.id}`);
    }
    rep.focus[tab] = { stops: seen.length, bad };
    ok(`a11y ${tab}: ${seen.length} Tab stops, all visible, none hidden, no positive tabindex, each has a focus indicator`, seen.length >= 3 && bad.length === 0, bad.slice(0, 6));
  }
  await p.close();
  // ---- skip link (a fresh page: the first Tab press starts at the top of the document)
  const sk = await open(1400, T.SITE, { query: '?lang=en' }); await sleep(600);
  await sk.key('Tab'); await sleep(120);
  const first = await sk.ev('(document.activeElement.className || "").toString() + "|" + document.activeElement.nodeName');
  ok('a11y: a "skip to content" link is the first Tab stop', /skip/.test(first), first);
  await sk.key('Enter'); await sleep(300);
  ok('a11y: the skip link moves focus to the heading of the open panel', await sk.ev('!!document.activeElement.closest(".hub-panel, .panel") && !document.activeElement.closest("[hidden]") && /^H[23]$/.test(document.activeElement.nodeName) && !location.hash.includes("main")'));
  await sk.close();

  // ---- contrast, both themes, every tab, English and Arabic
  rep.contrast = {};
  for (const lang of ['en', 'ar']) {
    for (const theme of ['light', 'dark']) {
      const c = await open(1400, T.SITE, { query: '?lang=' + lang }); await sleep(500);
      await c.ev(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`); await sleep(200);
      for (const tab of TABS) {
        await c.ev(`document.getElementById("t-${tab}").click()`); await sleep(tab === 'world' || tab === 'places' ? 3000 : 1500);
        const r = await c.ev(CONTRAST); rep.contrast[`${lang}-${theme}-${tab}`] = r;
        ok(`a11y contrast ${lang} ${theme} ${tab}: ${r.checked} text elements, ${r.n} below WCAG AA`, r.n === 0, r.fails.slice(0, 5));
      }
      await c.close();
    }
  }

  // ---- RTL mirroring (Arabic)
  const r = await open(1400, T.SITE, { query: '?lang=ar' }); await sleep(800);
  const mir = await r.ev(`(() => { const rc = id => document.getElementById(id).getBoundingClientRect(), h = document.documentElement;
    return { dir: h.dir, lang: h.lang, firstRightOfLast: rc('t-timeline').right > rc('t-about').right, tabsAlign: getComputedStyle(document.querySelector('.hub-tabs')).direction,
      bodyDir: getComputedStyle(document.body).direction, switchPressed: document.querySelector('#langSw [data-lang=ar]').getAttribute('aria-pressed') }; })()`);
  rep.rtl = mir;
  ok('a11y rtl: Arabic sets dir=rtl and lang=ar, the first tab sits at the right, the language switch shows Arabic pressed', mir.dir === 'rtl' && mir.lang === 'ar' && mir.firstRightOfLast && mir.switchPressed === 'true', mir);
  await r.ev('document.getElementById("t-timeline").focus()'); await r.key('ArrowLeft'); await sleep(250);
  ok('a11y rtl: ArrowLeft moves to the next tab in Arabic', await r.ev('document.activeElement.id === "t-map"'));
  const phys = {};
  for (const tab of TABS) {
    await r.ev(`document.getElementById("t-${tab}").click()`); await sleep(tab === 'world' || tab === 'places' ? 3000 : 1500);
    // inside the open panel: text must align to the start (right), and nothing may stick out of the viewport on the right or left
    phys[tab] = await r.ev(`(() => { const root = document.querySelector('.panel:not([hidden]), .hub-panel:not([hidden])'), W = document.documentElement.clientWidth; const out = [];
      root.querySelectorAll('h2, h3, p, li, label, .lead, .note').forEach(e => { if (e.closest('svg, [data-notr], .mono, code') || !e.getBoundingClientRect().width) return; const cs = getComputedStyle(e); if (cs.direction !== 'rtl') return; if (cs.textAlign === 'left') out.push(e.nodeName + ':' + (e.textContent || '').slice(0, 24)); });
      const over = [...root.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) && !e.closest('svg, canvas, .hub-tabs, [style*=overflow], .tbl, table, .fb-tbl, .scroll') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(e => e.nodeName + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 20));
      return { leftAligned: out.slice(0, 5), overflow: over }; })()`);
    ok(`a11y rtl ${tab}: Arabic text is start-aligned and nothing sticks out of the viewport`, phys[tab].leftAligned.length === 0 && phys[tab].overflow.length === 0, phys[tab]);
  }
  rep.rtlPanels = phys;
  await r.ev('document.querySelector("#langSw [data-lang=en]").click()'); await sleep(300);
  await r.close();
  writeFileSync(join(T.out, 'a11y.json'), JSON.stringify(rep, null, 1));
}
