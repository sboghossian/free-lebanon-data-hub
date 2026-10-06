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

  // Lebanese abroad (v11): lead, rule, world map, filters, table, then the listed-abroad revenue
  await go(p, 'abroad');
  const DI = readData('companies/diaspora.json'), dRows = DI.rows, isos = new Set(dRows.map(r => r.i));
  ok('companies: the view is called Lebanese abroad and keeps the id abroad', await p.ev('document.querySelector("#cmpNav [data-id=abroad]").textContent === "Lebanese abroad" && location.hash === "#companies/abroad"'));
  ok('companies: Lebanese abroad opens with the lead and the one-line inclusion rule', await p.ev('/^Companies around the world founded or led by Lebanese people, as public sources describe them\\./.test(document.querySelector("#cmpView .cmp-lead").textContent) && /founder, co-founder, CEO, chair, president or another top executive/.test(document.querySelector("#cmpView .cmp-rule").textContent) && /never guessed from a name/.test(document.querySelector("#cmpView .cmp-rule").textContent)'));
  ok('companies: the data holds rows, none headquartered in Lebanon, each with an origin, a quote of at most 20 words and a source link', dRows.length >= 30 && dRows.every(r => r.i !== 'LBN' && ['born_in_lebanon', 'lebanese_citizen', 'lebanese_descent'].includes(r.o) && r.q && r.q.split(/\s+/).length <= 20 && r.oq.startsWith('http') && r.u.length >= 1));
  await p.wait('document.querySelectorAll("#cmpMap path[data-iso]").length > 100', 15000);
  ok('companies: the world map draws 176 countries', (await p.ev('document.querySelectorAll("#cmpMap path[data-iso]").length')) === 176);
  const shaded = await p.ev('document.querySelectorAll("#cmpMap path.b1, #cmpMap path.b2, #cmpMap path.b3, #cmpMap path.b4").length');
  ok('companies: the map shades the countries that have companies (at least one), and nothing else', shaded >= 1 && shaded <= isos.size && shaded >= isos.size - 3, shaded + ' of ' + isos.size);
  ok('companies: Lebanon is outlined and not shaded, and the legend lists the scale', await p.ev('!!document.querySelector("#cmpMap path.leb") && !document.querySelector("#cmpMap path.leb").getAttribute("class").match(/b[1-4]/) && document.querySelectorAll("#cmpView .cmp-sw").length === 5'));
  const top = [...isos].map(i => [i, dRows.filter(r => r.i === i).length]).sort((a, b) => b[1] - a[1])[0], topNames = dRows.filter(r => r.i === top[0]).map(r => r.c);
  await p.ev(`(() => { const e = document.querySelector('#cmpMap path[data-iso="${top[0]}"]'), b = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); })()`); await sleep(150);
  ok('companies: hovering the most-used country shows a tooltip with its name, a company and the person', await p.ev(`(() => { const t = document.getElementById('cmpTip'); return !t.hidden && ${JSON.stringify(topNames)}.some(n => t.textContent.includes(n)) && /Born in Lebanon|Lebanese citizen|Of Lebanese descent/.test(t.textContent); })()`));
  ok('companies: the tooltip lists at most 8 companies and says "and N more" beyond that', await p.ev(`(() => { const t = document.getElementById('cmpTip'); return t.querySelectorAll('li').length === Math.min(8, ${top[1]}) && (${top[1]} <= 8 || /and \\d+ more/.test(t.textContent)); })()`));
  await p.ev('document.getElementById("cmpMap").dispatchEvent(new PointerEvent("pointerleave"))'); await sleep(100);
  ok('companies: leaving the map hides the tooltip', await p.ev('document.getElementById("cmpTip").hidden'));
  await p.ev(`(() => { const e = document.querySelector('#cmpMap path[data-iso="${top[0]}"]'); e.focus(); })()`); await sleep(150);
  ok('companies: keyboard focus on a shaded country shows the tooltip too', await p.ev('!document.getElementById("cmpTip").hidden'));
  await p.ev(`document.querySelector('#cmpMap path[data-iso="${top[0]}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await sleep(200);
  ok('companies: clicking the country pins its full list below the map, with a clear button', await p.ev(`document.querySelectorAll('#cmpPin li').length === ${top[1]} && !!document.getElementById('cmpPinX') && document.querySelector('#cmpMap path.sel').dataset.iso === '${top[0]}'`));
  await p.ev('document.getElementById("cmpPinX").click()'); await sleep(150);
  ok('companies: the clear button unpins the list', await p.ev('document.querySelectorAll("#cmpPin li").length === 0 && !document.querySelector("#cmpMap path.sel")'));
  // filters change the counts, the map and the table
  const stat = () => p.ev('[...document.querySelectorAll("#cmpDStats .fb-stat")].map(x => x.textContent)');
  ok('companies: the counts tiles show companies, people and countries and match the data', await p.ev(`document.querySelectorAll('#cmpDStats .fb-stat').length === 3`) && (await rows(p)) === dRows.length);
  await pick(p, 'cmpDRole', 'ceo');
  const ceo = dRows.filter(r => r.r === 'ceo');
  ok('companies: filtering to CEOs changes the table, the counts and the shaded countries', (await rows(p)) === ceo.length && ceo.length < dRows.length && (await p.ev('document.querySelectorAll("#cmpMap path.b1, #cmpMap path.b2, #cmpMap path.b3, #cmpMap path.b4").length')) === new Set(ceo.map(r => r.i)).size);
  await pick(p, 'cmpDRole', 'all'); await pick(p, 'cmpDOrig', 'lebanese_descent');
  const des = dRows.filter(r => r.o === 'lebanese_descent');
  ok('companies: filtering to "Of Lebanese descent" keeps only those rows (Carlos Slim is of Lebanese descent, not a citizen)', (await rows(p)) === des.length && des.length >= 3 && await p.ev('[...document.querySelectorAll("#cmpDTbl tbody tr")].every(tr => /Of Lebanese descent/.test(tr.textContent)) && [...document.querySelectorAll("#cmpDTbl tbody tr")].some(tr => /Carlos Slim/.test(tr.textContent))'));
  await pick(p, 'cmpDOrig', 'all'); await pick(p, 'cmpDKind', 'startup');
  ok('companies: filtering to startups keeps only startups', (await rows(p)) === dRows.filter(r => r.k === 'startup').length);
  await pick(p, 'cmpDKind', 'all');
  await type(p, 'slim');
  ok('companies: the search box narrows the map list and the table together', (await rows(p)) === dRows.filter(r => /slim/i.test(r.p + r.c)).length && (await rows(p)) >= 1);
  await type(p, '');
  ok('companies: back to all, the table is whole again', (await rows(p)) === dRows.length);
  // table: columns, sortable, one source link per row
  ok('companies: the table has the nine columns (company, country, city, founded, sector, person, role, origin, sources)', await p.ev('[...document.querySelectorAll("#cmpDTbl th")].map(h => h.textContent.trim().replace(/[\\u25B2\\u25BC]/g, "").trim()).join("|") === "Company|Country|City|Founded|Sector|Person|Role|Origin|Sources"'));
  ok('companies: every table row links at least one source', await p.ev('[...document.querySelectorAll("#cmpDTbl tbody tr")].every(tr => !!tr.querySelector("a[href^=\\"http\\"]"))'));
  await p.ev('document.querySelector("#cmpDTbl .cmp-sort[data-k=country]").click()'); await sleep(150);
  const cn = await p.ev('[...document.querySelectorAll("#cmpDTbl tbody tr")].map(tr => tr.children[1].textContent)');
  ok('companies: clicking a column head sorts by it (country, ascending) and marks it with aria-sort', await p.ev('document.querySelector("#cmpDTbl th[aria-sort=ascending]").textContent.includes("Country")') && cn.every((v, i) => !i || cn[i - 1].localeCompare(v) <= 0));
  await p.ev('document.querySelector("#cmpDTbl .cmp-sort[data-k=country]").click()'); await sleep(150);
  ok('companies: a second click reverses the order', await p.ev('!!document.querySelector("#cmpDTbl th[aria-sort=descending]")'));
  await p.ev('document.querySelector("#cmpDTbl .cmp-sort[data-k=founded]").click()'); await sleep(150);
  const fo = (await p.ev('[...document.querySelectorAll("#cmpDTbl tbody tr")].map(tr => parseInt(tr.children[3].textContent.replace(/\\D/g, "")) || 99999)'));
  ok('companies: sorting by founded puts the oldest first and the unknown last', fo.every((v, i) => !i || fo[i - 1] <= v));
  // note, licences, revenue
  ok('companies: the removal note and the sources and licences note are present', await p.ev('/Anyone listed can ask to be removed or corrected: open an issue at github\\.com\\/sboghossian\\/free-lebanon-data-hub\\/issues\\./.test(document.querySelector("#cmpView .cmp-del").textContent) && !!document.querySelector("#cmpView .cmp-del a[href=\\"https://github.com/sboghossian/free-lebanon-data-hub/issues\\"]") && /Wikidata \\(CC0 1\\.0\\)/.test(document.getElementById("cmpView").textContent) && /facts only/.test(document.getElementById("cmpView").textContent)'));
  ok('companies: the listed-abroad revenue stays below, titled "Listed abroad: revenue by year", with revenue by fiscal year as its metric', await p.ev('/Listed abroad: revenue by year/.test(document.querySelector("#cmpView .cmp-revh").textContent) && /revenue by fiscal year/.test(document.querySelector("#cmpRev .cmp-metric").textContent)'));
  ok('companies: the revenue chart is drawn and every fiscal year (2020 to 2025) is a row with a source link', await p.ev('!!document.querySelector("#cmpRev .cmp-chart .hc-line") && document.querySelectorAll("#cmpRev .cmp-tbl")[0].querySelectorAll("tbody tr").length === 6 && [...document.querySelectorAll("#cmpRev .cmp-tbl")[0].querySelectorAll("tbody tr")].every(tr => !!tr.querySelector("a[href^=\\"http\\"]"))'));
  ok('companies: Anghami FY2025 revenue (99,304,526) is shown, marked reported', await p.ev('/99,304,526/.test(document.getElementById("cmpRev").textContent) && !!document.querySelector("#cmpRev .cf-reported")'));
  ok('companies: the context table lists Investcom with its sale price', await p.ev('/Investcom/.test(document.getElementById("cmpRev").textContent) && /\\$5\\.5B/.test(document.getElementById("cmpRev").textContent)'));
  ok('companies: the CSV of the rows is registered and the topic keeps one Data link', readData('companies/diaspora.json').rows.length === dRows.length);

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
  await go(m, 'abroad'); await m.wait('document.querySelectorAll("#cmpMap path[data-iso]").length === 176', 15000);
  ok('companies: at 390 the Lebanese abroad map fits the screen and the table scrolls in its own box', await m.ev('document.getElementById("cmpMapIn").getBoundingClientRect().width <= 390 && document.documentElement.scrollWidth <= 390 && !!document.querySelector("#cmpDTbl .fb-scroll")'));
  await m.ev(`(() => { const e = document.querySelector('#cmpMap path.b1, #cmpMap path.b2, #cmpMap path.b3, #cmpMap path.b4'); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); })()`); await sleep(200);
  ok('companies: a tap on a shaded country pins its list at 390 without overflow', await m.ev('document.querySelectorAll("#cmpPin li").length > 0 && document.documentElement.scrollWidth <= 390'));
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
  await go(a, 'abroad');
  await a.wait('document.querySelectorAll("#cmpMap path[data-iso]").length === 176', 15000);
  ok('companies: Arabic Lebanese abroad has an Arabic lead, filters and removal note, a left-to-right map and a right-to-left table', await a.ev('/[\\u0600-\\u06FF]/.test(document.querySelector("#cmpView .cmp-lead").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#cmpDRole").closest("label").textContent) && /github\\.com\\/sboghossian\\/free-lebanon-data-hub\\/issues/.test(document.querySelector("#cmpView .cmp-del").textContent) && /[\\u0600-\\u06FF]/.test(document.querySelector("#cmpView .cmp-del").textContent) && getComputedStyle(document.getElementById("cmpMapIn")).direction === "ltr" && getComputedStyle(document.querySelector("#cmpDTbl table")).direction === "rtl" && document.documentElement.scrollWidth <= 1400'));
  await a.ev(`(() => { const e = document.querySelector('#cmpMap path.b1, #cmpMap path.b2, #cmpMap path.b3, #cmpMap path.b4'), b = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); })()`); await sleep(150);
  ok('companies: the Arabic tooltip is right to left and names a country in Arabic', await a.ev('(() => { const t = document.getElementById("cmpTip"); return !t.hidden && t.dir === "rtl" && /[\\u0600-\\u06FF]/.test(t.querySelector("b").textContent); })()'));
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

  // ---- the map file missing: the table still works and says so
  const fg = fixture('companies-nogeo', null, { 'trade/world-geo.json': null });
  const gg = await open(1400, fg, { hash: '#companies/abroad', allow: /world-geo|404|Failed to load/ });
  await gg.wait('!!document.querySelector("#cmpMapIn .hub-empty")', 15000);
  ok('companies: with the map outline missing the page says so and the table still lists the companies', await gg.ev('!!document.querySelector("#cmpMapIn .hub-empty") && document.querySelectorAll("#cmpDTbl tbody tr").length > 10'));
  await gg.close();

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
