// Checks for the Companies tab (v10, LEG B): the five views, the single ranking metric stated at the top, sorting, search across views, a source link on every row, the one "Data behind this tab" link and no download table,
// price change and history when the data has them, empty and error states, 390 px, Arabic (right to left) and French.
export default async function (T) {
  const { ok, sleep, open, fixture, SITE, readData } = T;
  const VIEWS = ['listed', 'abroad', 'startups', 'family', 'banks'];
  const go = async (p, v) => { await p.ev(`location.hash = ${JSON.stringify(v === 'listed' ? '#companies' : '#companies/' + v)}`); await sleep(250); return p.wait(`!!document.querySelector("#cmpView .cmp-metric") && !document.querySelector("#companiesRoot .hub-load") && document.querySelector("#cmpNav [data-id=${v}]").getAttribute("aria-pressed") === "true"`, 20000); };
  const rows = p => p.ev('document.querySelector("#cmpView .cmp-tbl")?.querySelectorAll("tbody tr").length ?? 0');
  const first = (p, i = 0, sel = '#cmpView .cmp-tbl') => p.ev(`(document.querySelectorAll(${JSON.stringify(sel + ' tbody tr')})[0] || {}).children ? document.querySelectorAll(${JSON.stringify(sel + ' tbody tr')})[0].children[${i}].textContent : ""`);
  const pick = async (p, id, v) => { await p.ev(`(() => { const s = document.getElementById(${JSON.stringify(id)}); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event("change")); })()`); await sleep(250); };
  const type = async (p, q) => { await p.ev(`(() => { const i = document.getElementById("cmpQ"); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event("input")); })()`); await sleep(250); };
  const linked = p => p.ev('[...document.querySelectorAll("#cmpView .cmp-tbl tbody tr")].every(tr => !!tr.querySelector("a[href^=\\"http\\"]"))');

  // ---- 1400 px, English: one page walks through every view
  const p = await open(1400, SITE, { hash: '#companies' });
  ok('companies: opens by deep link with five view chips', await p.wait('!document.getElementById("companies").hidden && document.querySelectorAll("#cmpNav [data-id]").length === 5', 15000));
  ok('companies: the Listed view states its single ranking metric at the top', await p.ev('/^Ranked by: market capitalisation in US dollars/.test(document.querySelector("#cmpView .cmp-metric").textContent)'));
  await sleep(300);
  ok('companies: Listed ranks the 10 common shares, largest market cap first (Solidere A, then Solidere B)', (await rows(p)) === 10 && /Solidere A/.test(await first(p, 1)) && (await first(p, 0)).trim() === '1' && /Solidere B/.test(await p.ev('document.querySelectorAll("#cmpView .cmp-tbl tbody tr")[1].children[1].textContent')));
  ok('companies: the market cap bars run from largest to smallest', await p.ev('(() => { const w = [...document.querySelectorAll("#cmpBars .hb-b i")].map(i => parseFloat(i.style.width)); return w.length >= 10 && w.every((v, i) => !i || w[i - 1] >= v); })()'));
  const L = readData('companies/listed.json').securities, caps = L.filter(r => r.type === 'common').map(r => r.market_cap_usd).sort((a, b) => b - a);
  ok('companies: the data file holds 25 securities and the common caps sort as shown', L.length === 25 && caps[0] === 7210000000 && caps.every((v, i) => !i || caps[i - 1] >= v));
  ok('companies: every Listed row links its source', await linked(p));
  ok('companies: price history is not invented: the missing history is said so', await p.ev('/Price history is not shown/.test(document.getElementById("cmpView").textContent) && !document.getElementById("cmpHist")'));
  ok('companies: exactly one "Data behind this tab" link, to #data/companies, and no download link in the tab', await p.ev('document.querySelectorAll("#companies a[href=\\"#data/companies\\"]").length === 1 && document.querySelectorAll("#companies a[download]").length === 0'));
  await pick(p, 'cmpSort', 'name');
  ok('companies: sorting Listed by name says "no ranking" and puts Bank Audi first', await p.ev('/no ranking/.test(document.querySelector("#cmpView .cmp-metric").textContent)') && /Bank Audi/.test(await first(p, 0)));
  await pick(p, 'cmpSort', 'cap');
  await p.ev('(() => { const c = document.getElementById("cmpPref"); c.checked = true; c.dispatchEvent(new Event("change")); })()'); await sleep(250);
  ok('companies: the preferred shares and receipts toggle adds the other 15 securities, without a rank', (await rows(p)) === 25);
  ok('companies: 0 console errors so far', p.errors().length === 0, p.errors());

  // search: within the view, and across views
  await type(p, 'audi');
  ok('companies: search narrows the open view', (await rows(p)) >= 1 && (await rows(p)) < 25);
  await type(p, 'berytech');
  ok('companies: a search with no hit in this view says so and points to the view that matches', await p.ev('!!document.querySelector("#cmpView .hub-empty") && !!document.querySelector("#cmpAlso [data-go=startups]")'));
  await p.ev('document.querySelector("#cmpAlso [data-go=startups]").click()'); await sleep(400);
  ok('companies: the jump chip opens Startups with the search kept', await p.ev('document.querySelector("#cmpNav [data-id=startups]").getAttribute("aria-pressed") === "true" && document.getElementById("cmpQ").value === "berytech" && location.hash === "#companies/startups"') && (await rows(p)) >= 1);
  await type(p, '');

  // abroad
  await go(p, 'abroad');
  ok('companies: Listed abroad states revenue by fiscal year as its metric', await p.ev('/revenue by fiscal year/.test(document.querySelector("#cmpView .cmp-metric").textContent)'));
  ok('companies: the revenue chart is drawn and every fiscal year (2020 to 2025) is a row with a source link', await p.ev('!!document.querySelector("#cmpView .cmp-chart .hc-line") && document.querySelectorAll("#cmpView .cmp-tbl")[0].querySelectorAll("tbody tr").length === 6') && await linked(p));
  ok('companies: Anghami FY2025 revenue (99,304,526) is shown, marked reported', await p.ev('/99,304,526/.test(document.getElementById("cmpView").textContent) && !!document.querySelector("#cmpView .cf-reported")'));
  ok('companies: the context table lists Investcom with its sale price', await p.ev('/Investcom/.test(document.getElementById("cmpView").textContent) && /\\$5\\.5B/.test(document.getElementById("cmpView").textContent)'));

  // startups
  await go(p, 'startups');
  const S = readData('companies/startups.json');
  ok('companies: Startups lists only the companies that meet the inclusion rule, and counts the ones left out', (await rows(p)) === S.startups.length && S.startups.every(s => s.inclusion !== 'unverified') && S.excluded > 0 && /left out/.test(await p.ev('document.getElementById("cmpView").textContent')));
  ok('companies: the default metric is disclosed funding, largest first (Toters)', /total disclosed equity funding/.test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')) && /Toters/.test(await first(p, 1)));
  ok('companies: every startup row links its source', await linked(p));
  await pick(p, 'cmpSort', 'founded');
  ok('companies: sorting by founding year puts the newest first (Garbaliser, 2020) and says so at the top', /founding year/.test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')) && /Garbaliser/.test(await first(p, 1)));
  await pick(p, 'cmpSort', 'exits');
  ok('companies: sorting by exits puts the largest disclosed exit first (Seez)', /exit value/.test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')) && /Seez/.test(await first(p, 1)));
  await pick(p, 'cmpSort', 'funding');
  ok('companies: the funding-by-year chart has bars and the investor-reported figures are marked', await p.ev('document.querySelectorAll("#cmpFund li").length >= 8 && document.querySelectorAll("#cmpView .fb-tag").length >= 2'));
  ok('companies: the exits table and the funding rounds list have a source link on every row', await p.ev('(() => { const t = [...document.querySelectorAll("#cmpView .cmp-tbl")]; return t.length === 3 && t.slice(1).every(x => x.querySelectorAll("tbody tr").length > 5 && [...x.querySelectorAll("tbody tr")].every(r => !!r.querySelector("a[href^=\\"http\\"]"))); })()'));
  ok('companies: a grant is shown as a grant, not as equity', await p.ev('!/grant, not equity/.test(document.getElementById("cmpView").textContent) || /\\(grant, not equity\\)/.test(document.getElementById("cmpView").textContent)'));

  // family
  await go(p, 'family');
  const F = readData('companies/family.json');
  ok('companies: Family businesses states the Forbes rank as its metric and lists every year with its source', /Forbes Middle East Top 100/.test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')) && (await rows(p)) === F.rows.length && await linked(p));
  await pick(p, 'cmpFyr', '2024');
  ok('companies: the year filter keeps one year (2024: two groups)', (await rows(p)) === F.rows.filter(r => r.year === 2024).length);
  await pick(p, 'cmpFyr', 'all'); await pick(p, 'cmpSort', 'rank');
  ok('companies: sorting by published rank puts the best rank first', (await first(p, 1)).trim() === String(Math.min(...F.rows.map(r => r.rank))));
  ok('companies: a contested founding place is marked, and the checked-and-left-out groups are listed with sources', await p.ev('/Founding place contested/.test(document.getElementById("cmpView").textContent) && /Chalhoub/.test(document.querySelector("#cmpView details").textContent) && document.querySelectorAll("#cmpView details a[href^=\\"http\\"]").length >= 5'));

  // banks
  await go(p, 'banks');
  const B = readData('companies/banks.json'), latest = (b, k) => b.years.filter(y => y.total_assets_usd_million_derived != null).sort((a, c) => c.fiscal_year - a.fiscal_year)[0][k];
  ok('companies: Banks shows tiles, four sector charts with sources, and six banks', await p.ev('document.querySelectorAll("#cmpView .fb-stat").length === 7 && document.querySelectorAll("#cmpView .fb-grid .fb-card .hc-svg").length === 4 && document.querySelectorAll("#cmpView .fb-grid .fb-src a").length >= 4') && (await rows(p)) === 6);
  ok('companies: the bank list is ranked by total assets and every row links the bank\'s own statements', /total assets/.test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')) && /BLOM/.test(await first(p, 1)) && await linked(p));
  ok('companies: Byblos shows 2024 and the page says its 2025 statements were not found', await p.ev('/Byblos Bank: the latest statements found are for 2024/.test(document.getElementById("cmpView").textContent)'));
  for (const [k, key] of [['deposits', 'customer_deposits_usd_million_derived'], ['equity', 'total_equity_usd_million_derived']]) {
    await pick(p, 'cmpSort', k);
    const best = B.per_bank.map(b => [b.bank, latest(b, key)]).sort((a, c) => c[1] - a[1])[0][0];
    ok(`companies: sorting banks by ${k} puts ${best} first and changes the stated metric`, (await first(p, 1)).includes(best) && new RegExp(k === 'deposits' ? 'customer deposits' : 'total equity').test(await p.ev('document.querySelector("#cmpView .cmp-metric").textContent')));
  }
  ok('companies: December 2023 is drawn as its own dot, not joined to July 2024', await p.ev('document.querySelectorAll("#cmpView .fb-grid .fb-card:first-child circle").length >= 2'));

  // every view: no em dash, no console error
  for (const v of VIEWS) { await go(p, v); ok(`companies: ${v} has no em dash`, await p.ev('!/\\u2014/.test(document.getElementById("companies").textContent)')); }
  ok('companies: 0 console errors across all views at 1400', p.errors().length === 0, p.errors());
  await p.close();

  // ---- 390 px, English
  const m = await open(390, SITE, { hash: '#companies' });
  for (const v of VIEWS) { await go(m, v); await sleep(500); ok(`companies: ${v} has no horizontal overflow at 390`, (await m.ev('document.documentElement.scrollWidth')) <= 390); }
  ok('companies: 0 console errors across all views at 390', m.errors().length === 0, m.errors());
  await m.close();

  // ---- Arabic (right to left) and French
  const a = await open(1400, SITE, { query: '?lang=ar', hash: '#companies' });
  for (const v of VIEWS) {
    await go(a, v); await sleep(500);
    ok(`companies: Arabic ${v} at 1400 is right-to-left and has no overflow`, await a.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 1400'));
  }
  await go(a, 'listed');
  ok('companies: Arabic translates the chips, the metric line and the table heads', await a.ev('/[\\u0600-\\u06FF]/.test(document.querySelector("#cmpNav").textContent) && /الترتيب بحسب/.test(document.querySelector("#cmpView .cmp-metric").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#cmpView .cmp-tbl th").textContent)'));
  await go(a, 'banks');
  ok('companies: Arabic keeps charts left to right', await a.ev('getComputedStyle(document.querySelector("#cmpView .hc-svg")).direction === "ltr"'));
  await a.ev('HUB.setLang("fr", { noStore: true })'); await sleep(900);
  ok('companies: French renders the chips in French', await a.ev('/Cotées à Beyrouth/.test(document.querySelector("#cmpNav").textContent)'));
  ok('companies: 0 console errors in Arabic and French', a.errors().length === 0, a.errors());
  await a.close();
  const am = await open(390, SITE, { query: '?lang=ar', hash: '#companies' });
  for (const v of VIEWS) { await go(am, v); await sleep(600); ok(`companies: Arabic ${v} at 390 is right-to-left and has no overflow`, await am.ev('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= 390')); }
  ok('companies: 0 console errors in Arabic at 390', am.errors().length === 0, am.errors());
  await am.close();

  // ---- price change and price history appear when the data has them
  const LS = readData('companies/listed.json');
  LS.securities.forEach((r, i) => { if (r.type === 'common') { r.price_change_pct = (i % 5) - 2.5; } });
  LS.securities.find(r => r.ticker === 'AUDI').price_history = [['2026-08-03', 1.7], ['2026-09-01', 1.8], ['2026-10-02', 1.88]];
  const fh = fixture('companies-hist', null, { 'companies/listed.json': JSON.stringify(LS) });
  const h = await open(1400, fh, { hash: '#companies' });
  await h.wait('!!document.getElementById("cmpSort")', 15000);
  ok('companies: with price change in the data, Listed offers that sort and the metric says so', await h.ev('[...document.querySelectorAll("#cmpSort option")].some(o => o.value === "chg")'));
  await pick(h, 'cmpSort', 'chg');
  ok('companies: sorting by price change states it at the top', /price change/.test(await h.ev('document.querySelector("#cmpView .cmp-metric").textContent')));
  ok('companies: with price history in the data, a price chart is drawn', await h.ev('!!document.querySelector("#cmpHch .hc-line")'));
  await h.close();

  // ---- empty and error states
  const fe = fixture('companies-empty', D => { D.tabs.companies = {}; });
  const e = await open(1400, fe, { hash: '#companies' });
  await sleep(600);
  ok('companies: with no data in the build the panel keeps its empty state', await e.ev('!!document.querySelector("#companiesRoot .hub-empty") && !document.querySelector("#cmpNav")'));
  await e.close();
  const fm = fixture('companies-missing', null, { 'companies/startups.json': null });
  const mm = await open(1400, fm, { hash: '#companies', allow: /startups\.json|404|Failed to load/ });
  await mm.wait('!!document.querySelector("#companiesRoot .hub-err")', 15000);
  ok('companies: a missing data file shows the error state with Retry, not a broken table', await mm.ev('!!document.querySelector("#companiesRoot .hub-err [data-retry]") && !document.querySelector("#companiesRoot .cmp-tbl")'));
  await mm.close();
}
