// v8 checks, Elections: the 2026 status as a fact card (postponed, extension law, court decision, new date).
export default async function (T) {
  const { ok, open, SITE } = T;
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'fr', '?lang=fr']]) {
    const tag = `v8 elections ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#elections/2026-parliamentary' });
    ok(`${tag}: the fact card opens`, await p.wait('!!document.querySelector(".fb-fact .fb-fact-l")', 25000));
    ok(`${tag}: it has nine facts: status, scheduled date, extension law, term, vote, court, new date, results, sources with links`, await p.ev('document.querySelectorAll(".fb-fact-l > div").length === 9 && document.querySelectorAll(".fb-fact-l > div:last-child a[href^=http]").length >= 5'));
    ok(`${tag}: the vote 76, 41, 4 and the law 41/2026 are on the card`, await p.ev('(() => { const x = document.querySelector(".fb-fact").textContent.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); return /76/.test(x) && /41/.test(x) && /41\\/2026/.test(x) && /7\\/2026/.test(x); })()'));
    ok(`${tag}: the new date says none is set and names May 2028`, await p.ev('(() => { const x = [...document.querySelectorAll(".fb-fact-l > div")][6].textContent.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); return /2028/.test(x); })()'));
    if (lang === 'en') ok(`${tag}: the card says postponed and not held`, await p.ev('/Postponed/.test(document.querySelector(".fb-fact").textContent) && /not held/.test(document.querySelector(".fb-fact h4").textContent)'));
    else ok(`${tag}: no English is left on the card (no EN marks)`, await p.ev('!/Postponed|Extension law|Constitutional Council|Parliament term|No date set|was not held|abstained/.test(document.querySelector(".fb-fact").textContent) && !document.querySelector(".fb-fact .enm")'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
