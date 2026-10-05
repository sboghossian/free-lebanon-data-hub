/* ------------------------------------------------------------ Places tab, v10 (leg B): services.
   (e) the Services block of a town page (det.sv from data/places/p/<district>.json: facilities mapped to the nearest place within 3 km) and the services map layer (off by default, data/places/facilities.json).
   Sources: OpenStreetMap health and education facilities (HOT export, snapshot 2026-10-03, ODbL 1.0) and the CERD list of public schools (2017, CC0). */
const PL_SVC_CAT = [
  { id: 'hospital', kinds: ['hospital'], label: N('Hospital'), col: 'var(--l-pol)' },
  { id: 'clinic', kinds: ['clinic'], label: N('Clinic'), col: 'var(--l-hist)' },
  { id: 'pharmacy', kinds: ['pharmacy'], label: N('Pharmacy'), col: 'var(--l-tech)' },
  { id: 'otherhealth', kinds: ['doctor', 'dentist', 'laboratory', 'health_other'], label: N('Other health: doctor, dentist, laboratory'), col: 'var(--l-world)' },
  { id: 'public', kinds: ['public_school'], label: N('Public school (CERD list, 2017)'), col: 'var(--l-region)' },
  { id: 'otherschool', kinds: ['school', 'kindergarten'], label: N('Other school or kindergarten (OpenStreetMap)'), col: 'var(--l-soc)' },
  { id: 'higher', kinds: ['college', 'university'], label: N('College or university'), col: 'var(--diesel)' }];
const PL_SVC_SRC = N('Facilities from OpenStreetMap contributors (ODbL 1.0, snapshot of {d}) and the CERD list of public schools (2017, CC0). OpenStreetMap coverage is uneven, so a missing point can mean unmapped, not absent.');
const PL_SVC_OSM = '2026-10-03';

/* the map layer: dots by category; the legend buttons switch a category off and on (state in PL.svcOff) */
function plSvcLayer(F) {
  const cat = {};
  PL_SVC_CAT.forEach(c => c.kinds.forEach(k => { cat[F.kinds.indexOf(k)] = c; }));
  const cnt = {}, dots = [];
  F.rows.forEach(x => {
    const c = cat[x[0]];
    if (!c) return;
    cnt[c.id] = (cnt[c.id] || 0) + 1;
    if (PL.svcOff.has(c.id)) return;
    const [px, py] = fbProj(PL.geo, x[3], x[4]);
    dots.push(`<circle class="pl-sv" cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="12" style="fill:${c.col}"><title>${esc((x[1] || x[2] || t(c.label)) + ' (' + t(c.label) + ')')}</title></circle>`);
  });
  const legend = `<ul class="pl-lg" aria-label="${esc(t('Facility kinds'))}">${PL_SVC_CAT.map(c => `<li><button type="button" class="pl-lgb" data-cat="${c.id}" aria-pressed="${!PL.svcOff.has(c.id)}"><i class="pl-sw" style="background:${c.col}"></i>${esc(t(c.label))} <span class="mono dim">${nf(cnt[c.id] || 0)}</span></button></li>`).join('')}</ul>`;
  return { svg: `<g class="pl-svs">${dots.join('')}</g>`, legend, cap: t(PL_SVC_SRC, { d: fmtDate(PL_SVC_OSM) }) };
}

/* a town page: counts of the facilities mapped to this place */
function plSvcBlock(box, d) {
  const sv = d.sv || [0, 0, 0, 0, 0, 0], items = [[N('Hospitals'), sv[0]], [N('Clinics'), sv[1]], [N('Pharmacies'), sv[2]], [N('Public schools'), sv[3]], [N('Other schools and kindergartens'), sv[4]], [N('Universities and colleges (campuses and buildings)'), sv[5]]];
  const cap = `<p class="note">${esc(t('Facilities within {r} km of this place\'s centre (3 km for a city, 2 km for a town, 1 km otherwise). Neighbouring places share points, so counts overlap and do not add up. Public schools come from the CERD list of 2017; other schools are OpenStreetMap schools that match no CERD school.', { r: nf(d.svr || 1) }))}</p>`;
  box.innerHTML = cap + (sv.some(v => v) ? fbStats(items.map(x => ({ k: t(x[0]), v: nf(x[1]) }))) : `<p class="hub-empty">${esc(t('No health or education facility is mapped within {r} km of this place\'s centre. OpenStreetMap coverage is uneven, so this can mean the facilities are unmapped.', { r: nf(d.svr || 1) }))}</p>`)
    + `<p class="note pl-vsrc">${esc(t(PL_SVC_SRC, { d: fmtDate(PL_SVC_OSM) }))}</p>`;
}
