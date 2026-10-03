// v8 checks, About: "What is incomplete" says, for each gap, what was done and what cannot be done, in English, Arabic and French.
export default async function (T) {
  const { ok, open, SITE } = T;
  for (const [w, lang, q] of [[1400, 'en', ''], [390, 'en', ''], [1400, 'ar', '?lang=ar'], [1400, 'fr', '?lang=fr'], [390, 'ar', '?lang=ar']]) {
    const tag = `v8 about ${lang} ${w}`;
    const p = await open(w, SITE, { query: q, hash: '#about' });
    ok(`${tag}: the About tab opens`, await p.wait('!document.getElementById("about").hidden && document.querySelectorAll("#aboutGaps li").length > 0', 20000));
    ok(`${tag}: nine gaps are listed, each with a bold label`, await p.ev('document.querySelectorAll("#aboutGaps li").length === 9 && [...document.querySelectorAll("#aboutGaps li")].every(l => !!l.querySelector("b"))'));
    if (lang === 'en') {
      ok(`${tag}: every gap says what was done and what is not possible`, await p.ev('[...document.querySelectorAll("#aboutGaps li")].every(l => /Done:/.test(l.textContent) && /Not possible:/.test(l.textContent))'));
      ok(`${tag}: the two hard limits are stated: no census since 1932, no complete civil-war strike record`, await p.ev('/no census since 1932/.test(document.getElementById("aboutGaps").textContent) && /no complete public record of the civil war exists/.test(document.getElementById("aboutGaps").textContent)'));
      ok(`${tag}: each original point is named: timeline before 1920, unreadable sources, strike map, places, cost and electricity, world, laws, elections, catalogue`, await p.ev('(() => { const x = document.getElementById("aboutGaps").textContent; return /Timeline before 1920/.test(x) && /four deeper passes/.test(x) && /OCR/.test(x) && /official toll/.test(x) && /registered voters/.test(x) && /district shows resident estimates/.test(x) && /proxy/.test(x) && /dashed and shaded/.test(x) && /Law 41\\/2026 of 9 March 2026/.test(x) && /31 May 2028/.test(x) && /last checked/.test(x); })()'));
      ok(`${tag}: the old line "There are no results for the 2026 parliamentary election" is gone`, await p.ev('!/There are no results for the 2026/.test(document.getElementById("about").textContent)'));
    } else ok(`${tag}: the list is in the page language, with no English sentence left`, await p.ev('(() => { const t = document.getElementById("aboutGaps").textContent; return !/Done:|Not possible:|census|Strike map|Dataset catalogue/.test(t) && /[\\u0600-\\u06ff]|Fait|Impossible/.test(t); })()'));
    ok(`${tag}: the count of rows still not machine-checked is a number that is the build count of unchecked rows in research/40-grounding.jsonl`, await p.ev('(() => { const n = document.getElementById("aboutN"); const v = Number((n ? n.textContent : "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, "")); return v === JSON.parse(document.getElementById("hubData").textContent).tabs.about.unchecked && v > 0; })()'));
    ok(`${tag}: no horizontal overflow`, (await p.ev('document.documentElement.scrollWidth')) <= w);
    ok(`${tag}: 0 console errors`, p.errors().length === 0, p.errors());
    await p.close();
  }
}
