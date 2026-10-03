/* World tab: the stage. One persistent element holds the 3D globe (globe.gl) and the flat map (d3-geo); views call WD.stage.show/update/focus/setMode.
   The globe needs WebGL; without it (or if the library cannot load) the flat map shows the same data. Colours come from the theme tokens (WD.tokens). */
(function () {
  const R = WD.stage = { mode: 'globe', noGL: false, el: null, S: { fill: () => null, tip: () => '', arcs: [], tag: '', sel: null, onPick: null } };
  const S = R.S, LB = [35.86, 33.85];
  const FOCUS = { world: { lat: 28, lng: 34, alt: 1.8, box: null }, mena: { lat: 29, lng: 30, alt: 1.2, box: [-18, 10, 62, 42] }, europe: { lat: 52, lng: 14, alt: 1.25, box: [-25, 34, 45, 72] },
    us: { lat: 39, lng: -97, alt: 1.2, box: [-128, 23, -65, 50] }, lebanon: { lat: 33.9, lng: 35.9, alt: 0.35, box: [33, 32.5, 38.5, 35] } };
  let globe = null, glHost = null, flat = null, flatHost = null, geo110 = null, geo50 = null, tipEl = null, pointer = [0, 0], hover = null, view = { cx: 0, cy: 0, k: 1 }, W = 1000, H = 500, proj = null, path = null;
  const hasGL = () => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return false; const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return true; } catch (e) { return false; } };
  const ll = iso => { const e = WD.ent[iso]; return e && e.ll ? e.ll : null; };
  WD.ll = ll;

  R.build = function () {
    if (R.el) return R.el;
    const el = R.el = document.createElement('div');
    el.className = 'wd-stage';
    el.innerHTML = `<div class="wd-gl" hidden tabindex="0" role="application" aria-label="${esc(t('3D globe. Drag to turn it, use the arrow keys to rotate and plus and minus to zoom.'))}"></div><div class="wd-flat" hidden></div><div class="wd-tip" role="tooltip" hidden></div>`
      + `<div class="wd-zoom"><button type="button" class="chip" data-z="in" aria-label="${esc(t('Zoom in'))}">+</button><button type="button" class="chip" data-z="out" aria-label="${esc(t('Zoom out'))}">−</button></div><p class="wd-fallback note" hidden></p>`;
    glHost = el.querySelector('.wd-gl'); flatHost = el.querySelector('.wd-flat'); tipEl = el.querySelector('.wd-tip');
    el.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => R.zoom(b.dataset.z === 'in' ? 1.6 : 1 / 1.6)));
    el.addEventListener('pointermove', ev => { const r = el.getBoundingClientRect(); pointer = [ev.clientX - r.left, ev.clientY - r.top]; if (!tipEl.hidden) placeTip(); });
    el.addEventListener('pointerleave', () => setHover(null));
    glHost.addEventListener('keydown', ev => {
      if (!globe) return;
      const p = globe.pointOfView(), step = 12 * Math.min(1.5, p.altitude), mv = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [step, 0], ArrowDown: [-step, 0] }[ev.key];
      if (mv) { ev.preventDefault(); globe.pointOfView({ lat: Math.max(-85, Math.min(85, p.lat + mv[0])), lng: p.lng + mv[1], altitude: p.altitude }, WD.reduce() ? 0 : 250); }
      else if (ev.key === '+' || ev.key === '=') R.zoom(1.4); else if (ev.key === '-') R.zoom(1 / 1.4);
    });
    if (window.ResizeObserver) new ResizeObserver(() => R.resize()).observe(el);
    if (window.IntersectionObserver) new IntersectionObserver(es => { if (globe) { if (es[0].isIntersecting) globe.resumeAnimation(); else globe.pauseAnimation(); } }).observe(el);
    return el;
  };
  function placeTip() {
    const r = R.el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = pointer[0] + 14, y = pointer[1] + 14;
    if (x + w > r.width - 4) x = Math.max(4, pointer[0] - w - 14);
    if (y + h > r.height - 4) y = Math.max(4, pointer[1] - h - 14);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  function setHover(iso) {
    if (iso === hover && (iso == null) === tipEl.hidden) return;
    hover = iso;
    const h = iso ? S.tip(iso) : '';
    if (!iso || !h) { tipEl.hidden = true; R.el.classList.remove('wd-hot'); return; }
    tipEl.dir = isRTL() ? 'rtl' : 'ltr'; tipEl.innerHTML = h; tipEl.hidden = false; R.el.classList.add('wd-hot'); placeTip();
  }
  R.size = () => { const w = R.el.clientWidth || 640; const base = Math.min(560, w < 520 ? w * 0.95 : w * 0.6), wide = w > 1000 ? Math.min(innerHeight * 0.82, w * 0.56) : 0; return [w, Math.round(Math.max(300, base, wide))]; };
  R.resize = () => { if (!R.el || !R.el.isConnected) return; const [w, h] = R.size(); R.el.style.setProperty('--wd-h', h + 'px'); if (globe) { globe.width(w).height(h); } if (flat) fitTag(); };

  /* ---------------------------------------------------------------- the globe */
  async function ensureGlobe() {
    if (globe) return true;
    if (!hasGL()) return false;
    try {
      await WD.script('globe');
      geo110 = geo110 || await WD.lib.geo('110');
      const T = WD.tokens(), [w, h] = R.size();
      const feats = geo110.countries.map(c => ({ type: 'Feature', properties: { iso: c.iso3 }, geometry: { type: 'MultiPolygon', coordinates: c.g } }));
      globe = Globe({ rendererConfig: { antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'default' } })(glHost)
        .width(w).height(h).backgroundColor('rgba(0,0,0,0)').showAtmosphere(false).showGraticules(false)
        .polygonsData(feats).polygonsTransitionDuration(0).polygonLabel(() => '')
        .polygonAltitude(d => d.properties.iso === 'LBN' ? 0.03 : 0.006)
        .onPolygonHover(p => setHover(p ? p.properties.iso : null))
        .onPolygonClick(p => { if (S.onPick && p) S.onPick(p.properties.iso); })
        .pointsData([{ lat: LB[1], lng: LB[0] }]).pointAltitude(0.045).pointRadius(0.32).pointsMerge(false)
        .htmlElementsData([{ lat: LB[1], lng: LB[0] }]).htmlAltitude(0.05).htmlElement(() => tagEl());
      if (globe.htmlElementVisibilityModifier) globe.htmlElementVisibilityModifier((el, vis) => { el.style.opacity = vis ? 1 : 0; });
      const c = globe.controls(); c.enablePan = false; c.autoRotate = false; c.enableDamping = !WD.reduce(); c.minDistance = 125; c.maxDistance = 420; c.rotateSpeed = 0.7;
      globe.pointOfView({ lat: FOCUS.world.lat, lng: FOCUS.world.lng, altitude: FOCUS.world.alt }, 0);
      themeGlobe(T);
      return true;
    } catch (e) { globe = null; glHost.innerHTML = ''; return false; }
  }
  const ocean = T => (T.dark ? T.seaSoft : WD.mix(T.seaSoft, T.sea, 0.3));
  let tagNode = null;
  function tagEl() { if (!tagNode) { tagNode = document.createElement('div'); tagNode.className = 'wd-tag'; tagNode.innerHTML = '<span class="wd-tag-in"></span>'; } tagNode.firstChild.textContent = S.tag; return tagNode; }
  function themeGlobe(T) {
    const m = globe.globeMaterial(); m.color.set(css(ocean(T))); if (m.emissive) { m.emissive.set('#000000'); m.emissiveIntensity = 0; } if (m.specular) m.specular.set('#000000'); m.shininess = 0;
    globe.lights().forEach(l => { if (l.isAmbientLight) { l.color.set('#ffffff'); l.intensity = 2.2; } else if (l.isDirectionalLight) { l.intensity = 0.9; } });
  }
  const css = WD.css;
  function drawGlobe() {
    const T = WD.tokens(); R.motion = !WD.reduce();
    themeGlobe(T);
    const stroke = css(T.ink, 0.28), war = css(T.war), ink = css(T.ink), none = css(T.mid);
    globe.polygonCapColor(d => S.fill(d.properties.iso) || none).polygonSideColor(d => css(T.rule2, 0.5))
      .polygonStrokeColor(d => d.properties.iso === 'LBN' ? war : d.properties.iso === S.sel ? ink : stroke)
      .polygonAltitude(d => d.properties.iso === 'LBN' ? 0.03 : d.properties.iso === S.sel ? 0.02 : 0.006);
    globe.pointColor(() => war);
    const arcs = S.arcs.filter(a => a.o && a.d);
    globe.arcsData(arcs).arcStartLat(a => a.o[1]).arcStartLng(a => a.o[0]).arcEndLat(a => a.d[1]).arcEndLng(a => a.d[0]).arcStroke(a => a.w)
      .arcColor(a => [css(T[a.c1 || 'diesel'], 0.95), css(T[a.c2 || 'cedar'], 0.95)]).arcsTransitionDuration(0).arcAltitudeAutoScale(0.5).arcLabel(a => '')
      .arcDashLength(WD.reduce() ? 1 : 0.5).arcDashGap(WD.reduce() ? 0 : 0.25).arcDashAnimateTime(WD.reduce() ? 0 : 3200);
    if (!WD.reduce()) globe.ringsData([{ lat: LB[1], lng: LB[0] }]).ringColor(() => k => css(T.war, 1 - k)).ringMaxRadius(3.2).ringPropagationSpeed(1.6).ringRepeatPeriod(1800);
    else globe.ringsData([]);
    if (tagNode) tagNode.firstChild.textContent = S.tag;
  }

  /* ---------------------------------------------------------------- the flat map */
  async function ensureFlat() {
    if (flat) return true;
    try {
      geo50 = geo50 || await WD.lib.geo('50');
      await WD.script('arry'); await WD.script('geo');
      const sphere = { type: 'Sphere' };
      proj = d3.geoEqualEarth().fitWidth(W - 8, sphere); const t0 = proj.translate(); proj.translate([t0[0] + 4, t0[1] + 4]);
      path = d3.geoPath(proj); const b = path.bounds(sphere); H = Math.ceil(b[1][1] + 4);
      const paths = geo50.countries.map(c => `<path class="wd-c${c.iso3 === 'LBN' ? ' lb' : ''}" data-iso="${esc(c.iso3)}" d="${path({ type: 'MultiPolygon', coordinates: c.g }) || ''}"/>`).join('');
      const pt = proj(LB);
      flatHost.innerHTML = `<svg class="wd-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Flat world map. Lebanon is marked.'))}"><defs><pattern id="wdHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--paper)"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--rule-2)" stroke-width="1.6"/></pattern></defs>`
        + `<path class="wd-sphere" d="${path(sphere)}"/><g class="wd-cs">${paths}</g><g class="wd-ar"></g><g class="wd-lt" transform="translate(${pt[0].toFixed(1)} ${pt[1].toFixed(1)})"><g class="wd-ltk"><circle class="wd-ring" r="9"/><circle class="wd-dot" r="4"/><path class="wd-lead" d="M5 -5L30 -26"/><text class="wd-lbl" x="33" y="-28"></text></g></g></svg>`;
      flat = flatHost.querySelector('svg');
      flat.addEventListener('pointerover', ev => { const p = ev.target.closest && ev.target.closest('.wd-c'); setHover(p ? p.dataset.iso : null); });
      flat.addEventListener('click', ev => { if (drag.moved) return; const p = ev.target.closest && ev.target.closest('.wd-c'); if (p && S.onPick) S.onPick(p.dataset.iso); });
      dragSetup();
      return true;
    } catch (e) { flat = null; flatHost.innerHTML = ''; return false; }
  }
  const drag = { on: false, moved: false, x: 0, y: 0 };
  function dragSetup() {
    flat.addEventListener('pointerdown', ev => { if (view.k <= 1.01) return; drag.on = true; drag.moved = false; drag.x = ev.clientX; drag.y = ev.clientY; });
    window.addEventListener('pointermove', ev => {
      if (!drag.on) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.moved = true; const f = (W / view.k) / flat.clientWidth; view.cx -= dx * f; view.cy -= dy * f; drag.x = ev.clientX; drag.y = ev.clientY; applyView();
    });
    window.addEventListener('pointerup', () => { if (drag.on) { drag.on = false; setTimeout(() => { drag.moved = false; }, 0); } });
  }
  function applyView() {
    const vw = W / view.k, vh = H / view.k;
    view.cx = Math.max(vw / 2, Math.min(W - vw / 2, view.cx)); view.cy = Math.max(vh / 2, Math.min(H - vh / 2, view.cy));
    flat.setAttribute('viewBox', `${(view.cx - vw / 2).toFixed(1)} ${(view.cy - vh / 2).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    flat.classList.toggle('wd-pan', view.k > 1.01); fitTag();
  }
  function fitTag() {   // marker and label keep their size on screen at any zoom
    if (!flat) return;
    const u = (W / view.k) / Math.max(1, flat.clientWidth), k = flat.querySelector('.wd-ltk');
    if (k) { k.setAttribute('transform', `scale(${u.toFixed(4)})`); const lbl = flat.querySelector('.wd-lbl'); lbl.textContent = S.tag; }
    flat.querySelectorAll('.wd-arc').forEach(a => { a.style.strokeWidth = (+a.dataset.w * u).toFixed(2); });
  }
  function drawFlat() {
    const T = WD.tokens(), none = 'url(#wdHatch)';
    flat.querySelectorAll('.wd-c').forEach(p => { const iso = p.dataset.iso; p.style.fill = S.fill(iso) || none; p.classList.toggle('sel', iso === S.sel); });
    const g = flat.querySelector('.wd-ar'), P = d3.geoPath(proj);
    g.innerHTML = S.arcs.filter(a => a.o && a.d).map(a => {
      const d = P({ type: 'LineString', coordinates: [a.o, a.d] }), e = proj(a.d), col = css(T[a.c2 || 'cedar'], 0.75);
      return d ? `<path class="wd-arc" data-w="${(a.w * 4).toFixed(2)}" d="${d}" style="stroke:${col}"/><circle class="wd-end" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="2.6" style="fill:${col}"/>` : '';
    }).join('');
    fitTag();
  }

  /* ---------------------------------------------------------------- API for the views */
  R.show = async function (host, mode) {
    R.build(); host.appendChild(R.el); R.resize();
    return R.setMode(mode || R.mode);
  };
  R.setMode = async function (mode) {
    const note = R.el.querySelector('.wd-fallback');
    let m = mode, why = '';
    if (m === 'globe') { if (!(await ensureGlobe())) { m = 'flat'; R.noGL = true; why = 'gl'; } else R.noGL = false; }
    if (m === 'flat' && !(await ensureFlat())) { R.failed = true; note.hidden = false; note.textContent = t('The map could not be loaded. The table below has the same values.'); glHost.hidden = flatHost.hidden = true; return 'none'; }
    R.failed = false; R.mode = m; glHost.hidden = m !== 'globe'; flatHost.hidden = m !== 'flat';
    R.el.querySelector('.wd-zoom').hidden = false;
    note.hidden = !why; note.textContent = why ? t('The 3D globe needs WebGL, which this browser does not provide. The flat map shows the same data.') : '';
    R.resize(); R.draw();
    return m;
  };
  R.draw = function () { R.el.style.setProperty('--wd-ocean', css(ocean(WD.tokens()))); if (R.mode === 'globe' && globe) drawGlobe(); else if (R.mode === 'flat' && flat) drawFlat(); if (hover) setHover(hover); };
  R.update = function (o) { Object.assign(S, o); R.draw(); };
  R.zoom = function (f) {
    if (R.mode === 'globe' && globe) { const p = globe.pointOfView(); globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: Math.max(0.15, Math.min(4, p.altitude / f)) }, WD.reduce() ? 0 : 300); }
    else if (flat) { view.k = Math.max(1, Math.min(60, view.k * f)); if (view.k === 1) { view.cx = W / 2; view.cy = H / 2; } applyView(); }
  };
  R.focus = function (name) {
    const f = FOCUS[name] || FOCUS.world;
    if (R.mode === 'globe' && globe) globe.pointOfView({ lat: f.lat, lng: f.lng, altitude: f.alt }, WD.reduce() ? 0 : 900);
    else if (flat) {
      if (!f.box) { view = { cx: W / 2, cy: H / 2, k: 1 }; }
      else { const a = proj([f.box[0], f.box[3]]), b = proj([f.box[2], f.box[1]]), bw = Math.abs(b[0] - a[0]), bh = Math.abs(b[1] - a[1]); view = { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, k: Math.max(1, Math.min(60, 0.92 * Math.min(W / bw, H / bh))) }; }
      applyView();
    }
  };
  R.hide = function () { setHover(null); if (R.el && R.el.parentNode) R.el.parentNode.removeChild(R.el); };
  R.pov = () => (globe ? globe.pointOfView() : null);
})();
