/* ------------------------------------------------------------ i18n: EN / AR / FR.
   t(en, vars)  plain text: looks up sha1(en)[:12] in the loaded language file (content strings, data/i18n/<lang>.json) and in the UI strings
                embedded in the page (D.i18n, built from build/i18n/ui*.json); falls back to the English. {name} in the string is filled from vars.
   th(en)       the same, escaped for HTML, and with a small "EN" mark when a content string has no translation yet (only once the language file has loaded).
   tc(en)       the same as t() for content strings; use it inside attributes and aria-labels (no mark).
   The English text is the key, so a template needs {placeholders} and a vars object, never a JS template literal with a value inside. */
const LANG_NAME = { en: 'English', ar: 'العربية', fr: 'Français' };
const LANGS = ['en', 'ar', 'fr'];
const I18N = { en: { ui: {}, content: {}, status: 'ready' }, ar: { ui: (D.i18n || {}).ar || {}, content: {}, status: 'idle' }, fr: { ui: (D.i18n || {}).fr || {}, content: {}, status: 'idle' } };
const langCbs = [];
const onLang = fn => { langCbs.push(fn); };
const isRTL = () => LANG === 'ar';

function sha1hex(str) {
  const msg = new TextEncoder().encode(str), ml = msg.length, nb = ((ml + 8) >> 6) + 1, w = new Uint32Array(nb * 16);
  for (let i = 0; i < ml; i++) w[i >> 2] |= msg[i] << (24 - (i & 3) * 8);
  w[ml >> 2] |= 0x80 << (24 - (ml & 3) * 8);
  w[nb * 16 - 1] = ml * 8;
  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const W = new Uint32Array(80);
  for (let b = 0; b < nb; b++) {
    for (let i = 0; i < 16; i++) W[i] = w[b * 16 + i];
    for (let i = 16; i < 80; i++) { const x = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]; W[i] = (x << 1) | (x >>> 31); }
    let a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (bb & c) | (~bb & d); k = 0x5A827999; }
      else if (i < 40) { f = bb ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = bb ^ c ^ d; k = 0xCA62C1D6; }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) >>> 0;
      e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = tmp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
}
const HKEY = new Map();
const hkey = en => { let k = HKEY.get(en); if (k === undefined) { k = sha1hex(en).slice(0, 12); HKEY.set(en, k); } return k; };
function tLookup(en) {
  const L = I18N[LANG]; if (!L || !en) return null;
  const k = hkey(en), v = L.content[k] !== undefined ? L.content[k] : L.ui[k];
  return v === undefined || v === '' ? null : v;
}
const fill = (s, vars) => vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
function t(en, vars) {
  en = en == null ? '' : String(en);
  let s = en;
  if (LANG !== 'en') { const v = tLookup(en); if (v != null) s = v; }
  return fill(s, vars);
}
const tc = t;
function tH(en, vars) {  // the template is escaped; the values in vars are HTML you built (already escaped)
  return esc(t(en)).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
}
const tp = (one, many, n, vars) => t(n === 1 ? one : many, { n: nf(n), ...vars });  // one/many: both literals, so the build finds them
const tpH = (one, many, n, vars) => tH(n === 1 ? one : many, { n: nf(n), ...vars });
/* a data sentence that holds ISO dates ("killed 2026-09-17; injured 2026-08-17"): the dates become {d1}, {d2} so the sentence has one translation key, and are written in the page language */
const tDates = s => { let n = 0; const vars = {}, key = String(s || '').replace(/\d{4}-\d{2}-\d{2}/g, m => { n++; vars['d' + n] = fmtDate(m); return '{d' + n + '}'; }); return /^\d{4}$/.test(key) ? fy(key) : t(key, vars); };
const enMark = () => `<sup class="enm" title="${esc(t('Not translated yet, shown in English'))}" aria-label="English">EN</sup>`;
function th(en, vars) {
  en = en == null ? '' : String(en);
  if (LANG === 'en' || !en) return esc(fill(en, vars));
  const v = tLookup(en);
  if (v != null) return esc(fill(v, vars));
  return esc(fill(en, vars)) + (I18N[LANG].status === 'ready' && /[A-Za-z]{3}/.test(en) ? enMark() : '');
}

/* number and date formats follow the language: en-US, ar-LB, fr-FR */
const monthCache = {};
function monShort(i) {
  if (LANG === 'en') return MON[i];
  const k = LANG + i;
  return monthCache[k] || (monthCache[k] = new Intl.DateTimeFormat(LANG_LOCALE[LANG], { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2000, i, 1)));
}
const nf = (n, d = 0) => fmt(n, d);
const fy = y => LANG === 'en' ? String(y) : new Intl.NumberFormat(LANG_LOCALE[LANG], { useGrouping: false }).format(+y);
const nfCompact = n => new Intl.NumberFormat(LANG_LOCALE[LANG], { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const fmtBytes = n => n >= 1048576 ? fmt(n / 1048576, 1) + ' MB' : n >= 1024 ? fmt(n / 1024, 0) + ' KB' : fmt(n, 0) + ' B';

/* static markup: text nodes and attributes of the page shell are recorded once, in English, before anything renders, then re-translated on every language change.
   Anything a script renders later must use t() itself. Mark an element data-notr to skip it. */
const STATIC_T = [];
const I18N_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const normWs = s => s.replace(/\s+/g, ' ').trim();
function i18nRecord(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    const p = n.parentNode;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || (p.closest && p.closest('[data-notr]')) || !/[A-Za-z]{2}/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  } });
  let n;
  while ((n = w.nextNode())) { const v = n.nodeValue; STATIC_T.push({ n, en: normWs(v), lead: /^\s/.test(v) ? ' ' : '', trail: /\s$/.test(v) ? ' ' : '' }); }
  root.querySelectorAll(I18N_ATTRS.map(a => '[' + a + ']').join(',')).forEach(el => {
    if (el.closest('[data-notr]')) return;
    I18N_ATTRS.forEach(a => { if (el.hasAttribute(a) && /[A-Za-z]{2}/.test(el.getAttribute(a))) STATIC_T.push({ el, a, en: el.getAttribute(a) }); });
  });
}
function i18nApply() {
  STATIC_T.forEach(r => {
    if (r.n) { if (r.n.isConnected) r.n.nodeValue = r.lead + t(r.en) + r.trail; }
    else r.el.setAttribute(r.a, t(r.en));
  });
  document.title = t('Free Lebanon Data Hub');
  $$('#langSw [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
}
function i18nDir() {
  const h = document.documentElement;
  h.lang = LANG; h.dir = isRTL() ? 'rtl' : 'ltr'; h.dataset.lang = LANG;
}
function loadLangFile(l) {
  const L = I18N[l];
  if (!L || l === 'en') return Promise.resolve();
  if (L.status === 'ready') return Promise.resolve();
  if (L.status === 'loading' && L.p) return L.p;
  L.status = 'loading';
  L.p = hubLoad('data/i18n/' + l + '.json', { retries: 0 }).then(o => { L.content = o || {}; L.status = 'ready'; }, () => { L.status = 'failed'; });
  return L.p;
}
let HAYT_LANG = null;
function indexTranslatedText() {  // search also matches the translated event titles and why lines
  const key = LANG + ':' + I18N[LANG].status;   // rebuilt once more when the content file arrives
  if (HAYT_LANG === key) return;
  HAYT_LANG = key;
  EV.forEach(e => { e._hayT = LANG === 'en' ? '' : nrm([t(e.title)].concat(e.parts.map(p => t(p.why || ''))).join(' ')); });
}
async function setLang(l, opts = {}) {
  if (!LANGS.includes(l)) l = 'en';
  LANG = l;
  if (!opts.noStore) store.set('hub-lang', l);
  i18nDir(); i18nApply();
  const done = () => {
    if (LANG !== l) return;
    i18nDir(); i18nApply(); indexTranslatedText();
    langCbs.forEach(fn => { try { fn(l); } catch (e) { console.error(e); } });
  };
  done();                       // the UI strings are embedded: switch at once
  if (l !== 'en' && I18N[l].status !== 'ready') { await loadLangFile(l); done(); }
}
$$('#langSw [data-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); }));
