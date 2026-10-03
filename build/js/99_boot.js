/* ------------------------------------------------------------ guilloche (banknote line-work) */
function drawGuilloche(cv) {
  const box = cv.parentElement.getBoundingClientRect();
  const w = Math.max(1, Math.floor(box.width)), h = Math.max(1, Math.floor(box.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement);
  const c1 = cs.getPropertyValue('--g-line').trim() || '#1B5E45', c2 = cs.getPropertyValue('--g-line-2').trim() || '#9A5E08';
  const seed = +(cv.dataset.seed || 1);
  ctx.lineWidth = 0.6;
  const bands = [[c1, 0.62, 16, 0.16], [c2, 0.8, 11, 0.12]];
  bands.forEach(([col, cyf, n, alpha], bi) => {
    ctx.strokeStyle = col; ctx.globalAlpha = alpha;
    const cy = h * cyf, amp = h * (bi ? 0.12 : 0.22);
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      for (let px = 0; px <= w; px += 2) {
        const t = px / w * Math.PI * 2;
        const yv = cy + amp * Math.sin(t * (3 + seed * 0.5) + k * 0.39) * Math.cos(t * 1.3 + k * 0.21 + bi) + (k - n / 2) * 0.9;
        if (px) ctx.lineTo(px, yv); else ctx.moveTo(px, yv);
      }
      ctx.stroke();
    }
  });
  // rosette at the right edge
  ctx.strokeStyle = c1; ctx.globalAlpha = 0.14;
  const rx = w - Math.min(90, w * 0.18), ry = h * 0.42, R0 = Math.min(h * 0.42, 70);
  for (let k = 0; k < 18; k++) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.03) {
      const rr = R0 * (0.62 + 0.38 * Math.cos(9 * a + k * 0.35));
      const px = rx + rr * Math.cos(a + k * 0.12), py = ry + rr * Math.sin(a + k * 0.12);
      if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawAllGuilloche() { $$('canvas.guilloche').forEach(cv => { if (cv.offsetParent !== null) drawGuilloche(cv); }); }
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAllGuilloche); } catch (e) { /* old browser */ }
new MutationObserver(drawAllGuilloche).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
renderers.answer = drawAllGuilloche;

/* ------------------------------------------------------------ resize + boot */
let rT = null;
window.addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    drawAllGuilloche();
    if (current === 'numbers') renderCharts();
    if (current === 'timeline') renderTimeline();
  }, 140);
});
// The page shell is English in the markup: record its text once, before anything renders, so a language change can translate it.
i18nRecord($('#main'));
const qLang = (location.search.match(/[?&]lang=(en|ar|fr)\b/) || [])[1], L0 = qLang || store.get('hub-lang') || 'en';
if (LANGS.includes(L0) && L0 !== 'en') { LANG = L0; i18nDir(); i18nApply(); }
current = 'timeline';
{ const p0 = hubParse(); hubShow(p0.tab || 'timeline', { args: p0.args, route: p0.tab ? p0.route : undefined }); }
if (LANG !== 'en') setLang(LANG, { noStore: !!qLang });  // fetch the content translations and re-render with them
drawAllGuilloche();
})();
