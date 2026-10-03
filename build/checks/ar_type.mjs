// Arabic typography: no visible element that holds Arabic letters (HTML or SVG text) has a letter-spacing other than 0 or "normal", and none is transformed.
const VIEWS = [['t-timeline', ''], ['t-map', ''], ['t-places', ''], ['t-cost', ''], ['t-electricity', ''], ['t-world', ''], ['t-data', ''], ['t-about', '']];
const SCAN = `(() => {
  const bad = [], seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const p = n.parentElement; if (!p || !/[\\u0600-\\u06FF]/.test(n.nodeValue) || /^(SCRIPT|STYLE)$/.test(p.nodeName)) continue;
    const r = p.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const ls = cs.letterSpacing;
    if ((ls !== 'normal' && parseFloat(ls) !== 0) || cs.textTransform !== 'none') { const k = p.nodeName + '.' + (p.getAttribute('class') || '') + ' ' + ls + ' ' + cs.textTransform; if (!seen.has(k)) { seen.add(k); bad.push(k); } }
  }
  return bad;
})()`;
export default async function (T) {
  const { ok, sleep, open } = T;
  const p = await open(1400, T.SITE, { query: '?lang=ar' });
  await sleep(600);
  const all = [];
  for (const [id] of VIEWS) {
    await p.ev(`document.getElementById(${JSON.stringify(id)}).click()`); await sleep(id === 't-world' ? 3500 : 2000);
    const bad = await p.ev(SCAN); all.push(...bad.map(b => id + ': ' + b));
  }
  ok('arabic type: in AR at 1400, no visible element with Arabic letters has a letter-spacing other than 0 or normal, or a text-transform', all.length === 0, all.slice(0, 8));
  const font = await p.ev(`(() => { const e = document.querySelector('.eyebrow, .k, .mono'); return e ? getComputedStyle(e).fontFamily : ''; })()`);
  ok('arabic type: mono labels use the Arabic face in AR', /IBM Plex Sans Arabic/.test(font), font);
  ok('arabic type: 0 console errors', p.errors().length === 0, p.errors().slice(0, 2));
  await p.close();
}
