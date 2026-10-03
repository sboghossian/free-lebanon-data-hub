"""Unit tests for harvest_news pure functions: no network, no Jev."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import harvest_news as h  # noqa: E402

DAY_PAGE = """<!-- All news items below this line -->{{Current events|year=2006|month=07|day=12|content=
* [[Israeli-Palestinian conflict]]
** An [[Israel]]i air strike destroys a building in [[Gaza City]]. [http://news.bbc.co.uk/x.stm (BBC)]
** [[2006 Israel-Lebanon crisis]]:
*** [[Hezbollah]] militants kidnap two [[Israel]]i soldiers. [http://www.haaretz.com/a.html (Haaretz)], [https://www.reuters.com/b (Reuters)] {{Webarchive|url=https://web.archive.org/web/2005/http://x |date=2005-06-20 }}
*** [[Lebanon]] calls back its ambassador to the US.
* Protesters march in [[Mexico]].
}}"""

YEAR_PAGE = """{{Year in Lebanon|2024}}
== Incumbents ==
* [[Najib Mikati]] was Prime Minister of Lebanon since 2021 and acting afterwards.
== Events ==
=== January ===
* 2 January – [[Israel]] conducts an airstrike in [[Beirut]], killing a Hamas leader.<ref>{{Cite web |date=2024-01-02 |title=Strike |url=https://example.com/strike |website=X}}</ref>
=== February ===
* 8 February
** An IDF drone targets a car in [[Nabatieh]] and kills a Hezbollah commander.<ref name="a">{{Cite web |url=https://example.org/dabs |title=t
 |access-date=2024-02-08}}</ref>
** Veterans protesting outside the [[Lebanese parliament]] are met with tear gas.
=== March ===
*5 March – Two Hezbollah members are killed in an IDF raid in Hula.
== Deaths ==
* 3 March – Someone, Lebanese politician (born 1930)
"""


class Strip(unittest.TestCase):
    def test_templates_nested_and_refs(self):
        s = "A {{foo|bar {{baz|x}} y}}b<ref name=a>cite {{x}}</ref> c<ref name=b/> d{{nowrap|e f}}"
        self.assertEqual(h.strip_markup(s), "A b c de f")

    def test_links_quotes_files(self):
        s = "[[File:a.jpg|thumb|cap [[Beirut]]]]The '''[[Port of Beirut|port]]''' [[Lebanon]]&nbsp;<br/>burns"
        self.assertEqual(h.strip_markup(s), "The port Lebanon burns")

    def test_external_links(self):
        self.assertEqual(h.strip_markup("Strike [http://a.com/x (Reuters)], [https://b.org/y (AP)] hits [https://c.com Beirut news]."),
                         "Strike hits Beirut news.")

    def test_convert(self):
        self.assertEqual(h.strip_markup("a {{convert|12|km|mi}} road"), "a 12 km road")


class Refs(unittest.TestCase):
    def test_current_events_style(self):
        raw = "x [http://a.com/1 (BBC)], [https://b.com/2 (AP)] {{Webarchive|url=https://web.archive.org/web/2/http://a.com/1 |date=1}}"
        self.assertEqual(h.extract_refs(raw), ["http://a.com/1", "https://b.com/2"])

    def test_year_page_style(self):
        raw = 'y<ref>{{Cite web |title=T |url=https://e.com/z?a=1 |archive-url=https://web.archive.org/web/1/https://e.com/z |access-date=1}}</ref><ref>https://f.org/q</ref>'
        self.assertEqual(h.extract_refs(raw), ["https://e.com/z?a=1", "https://f.org/q"])

    def test_archive_kept_when_alone(self):
        self.assertEqual(h.extract_refs("{{Webarchive|url=https://web.archive.org/web/1/x}}"), ["https://web.archive.org/web/1/x"])


class Bullets(unittest.TestCase):
    def test_split_and_inherit(self):
        bs = h.split_bullets(DAY_PAGE)
        self.assertEqual([b["depth"] for b in bs], [1, 2, 2, 3, 3, 1])
        child = bs[3]
        self.assertEqual(len(child["parents"]), 2)
        txt = h.item_text(child)
        self.assertTrue(txt.startswith("Israeli-Palestinian conflict: 2006 Israel-Lebanon crisis: Hezbollah militants kidnap"), txt)
        self.assertNotIn("Webarchive", txt)

    def test_multiline_cite_joined(self):
        bs = h.split_bullets(YEAR_PAGE)
        b = [x for x in bs if "Nabatieh" in x["raw"]][0]
        self.assertEqual(h.extract_refs(b["raw"]), ["https://example.org/dabs"])

    def test_sibling_does_not_inherit(self):
        bs = h.split_bullets("* A\n** B\n* C\n** D")
        self.assertEqual([len(b["parents"]) for b in bs], [0, 1, 0, 1])
        self.assertEqual(bs[3]["parents"], ["C"])


class Dates(unittest.TestCase):
    def test_day_page_items(self):
        items = h.items_from_page("en.wikipedia.org", "Portal:Current events/2006 July 12", DAY_PAGE)
        self.assertEqual({i["date"] for i in items}, {"2006-07-12"})
        self.assertEqual({i["prec"] for i in items}, {"day"})
        texts = [i["text"] for i in items]
        self.assertTrue(any("Hezbollah militants kidnap" in t for t in texts))
        self.assertFalse(any("Mexico" in t for t in texts))  # no Lebanon term
        kid = [i for i in items if "kidnap" in i["text"]][0]
        self.assertEqual(kid["refs"], ["http://www.haaretz.com/a.html", "https://www.reuters.com/b"])

    def test_month_day_prefix(self):
        self.assertEqual(h.parse_date_prefix("5 January – Foo happens in Beirut", year=2024)[:2], ("2024-01-05", "day"))
        self.assertEqual(h.parse_date_prefix("January 5 – Foo", year=2024)[:2], ("2024-01-05", "day"))
        self.assertEqual(h.parse_date_prefix("June 5, 1982 – Foo")[:2], ("1982-06-05", "day"))
        self.assertEqual(h.parse_date_prefix("5–7 March: Foo", year=1990)[:2], ("1990-03-05", "day"))
        self.assertEqual(h.parse_date_prefix("2 Mai 1999 : x", year=1999)[:2], ("1999-05-02", "day"))
        r = h.parse_date_prefix("5 January – Foo", year=2024)
        self.assertEqual(r[2], "Foo")
        self.assertIsNone(h.parse_date_prefix("5 January – Foo"))  # no year anywhere

    def test_heading_day_wins_over_text_reference(self):
        r = h.parse_date_prefix("Since 12 July, officials said 421 were killed", year=2006, month=7, day=29)
        self.assertEqual(r[:2], ("2006-07-29", "day"))
        self.assertEqual(r[2], "Since 12 July, officials said 421 were killed")
        self.assertEqual(h.parse_date_prefix("Since 12 July, x", year=2006, month=7)[:2], ("2006-07", "month"))

    def test_french_and_arabic(self):
        self.assertEqual(h.strip_markup("{{date+|2 avril}}, [[guerre du Liban]] : début"), "2 avril, guerre du Liban: début")
        self.assertEqual(h.parse_date_prefix("2 avril, guerre du Liban : début du siège", year=1981)[:2], ("1981-04-02", "day"))
        self.assertEqual(h.parse_date_prefix("1er mai : x", year=1990)[:2], ("1990-05-01", "day"))
        self.assertEqual(h.parse_date_prefix("Mardi 19 mai 2009: le procureur inculpe", )[:2], ("2009-05-19", "day"))
        self.assertEqual(h.parse_date_prefix("On Tuesday 3 June, troops move in", year=1982)[:2], ("1982-06-03", "day"))
        self.assertEqual(h.parse_date_prefix("6 au 14 mars: l'armée bombarde", year=2017)[:2], ("2017-03-06", "day"))
        self.assertEqual(h.parse_date_prefix("4 يناير - وفاة أم", year=2022)[:2], ("2022-01-04", "day"))
        self.assertEqual(h.parse_date_prefix("20 تشرين الأول - حدث", year=2022)[:2], ("2022-10-20", "day"))

    def test_year_and_month_context(self):
        self.assertEqual(h.parse_date_prefix("Foo happened", year=2020, month=8)[:2], ("2020-08", "month"))
        self.assertEqual(h.parse_date_prefix("Foo happened", year=2020)[:2], ("2020", "year"))
        self.assertEqual(h.parse_date_prefix("12: Foo happened", year=2020, month=8)[:2], ("2020-08-12", "day"))
        self.assertEqual(h.parse_date_prefix("1840: October: Battle of Beirut", lead_year=True)[:2], ("1840-10", "month"))
        self.assertEqual(h.parse_date_prefix("1999 al-Iqbal newspaper begins", lead_year=True)[:2], ("1999", "year"))
        self.assertEqual(h.parse_date_prefix("31 June – x", year=2000)[:2], ("2000-06", "month"))

    def test_year_page_sections(self):
        items = h.items_from_page("en.wikipedia.org", "2024 in Lebanon", YEAR_PAGE)
        got = {(i["date"], i["prec"]) for i in items}
        self.assertEqual(got, {("2024-01-02", "day"), ("2024-02-08", "day"), ("2024-03-05", "day")})
        self.assertFalse(any("Someone" in i["text"] or "Najib" in i["text"] for i in items))  # Deaths / Incumbents skipped
        nab = [i for i in items if "Nabatieh" in i["text"]][0]
        self.assertTrue(nab["text"].startswith("An IDF drone"), nab["text"])
        self.assertEqual(nab["refs"], ["https://example.org/dabs"])
        self.assertEqual(len(items), 4)  # date-only parent "8 February" is not an item; its two children are

    def test_heading_dates(self):
        self.assertEqual(h.heading_date("8 October"), (None, 10, 8))
        self.assertEqual(h.heading_date("November 2024"), (2024, 11, None))
        self.assertEqual(h.heading_date("2023"), (2023, None, None))
        self.assertIsNone(h.heading_date("Ceasefire"))

    def test_range_title_year_rollover(self):
        txt = "== November ==\n=== 24 November ===\n* Israel and Hezbollah exchange fire in southern Lebanon today.\n== January ==\n=== 1 January ===\n* Hezbollah fires rockets into northern Israel from Lebanon.\n"
        items = h.items_from_page("en.wikipedia.org", "Timeline of the Israel–Hezbollah conflict (24 November 2023 – 1 January 2024)", txt)
        self.assertEqual([i["date"] for i in items], ["2023-11-24", "2024-01-01"])

    def test_title_date(self):
        self.assertEqual(h.title_date("Portal:Current events/2006 July 12"), "2006-07-12")
        self.assertEqual(h.title_date("Portal:Current events/2026 September 3"), "2026-09-03")
        self.assertIsNone(h.title_date("2024 in Lebanon"))


class Filter(unittest.TestCase):
    def test_tripoli_libya_rule(self):
        self.assertFalse(h.lebanon_match("Fighting erupts in Tripoli, Libya, between rival militias"))
        self.assertFalse(h.lebanon_match("Clashes in Tripoli kill five"))
        self.assertTrue(h.lebanon_match("Clashes in Tripoli, Lebanon kill five"))
        self.assertTrue(h.lebanon_match("Gunmen attack soldiers in the city of Tripoli in north Lebanon"))

    def test_terms(self):
        for t in ("Hezbollah fires rockets", "Israeli strike near Sidon", "UNIFIL peacekeepers hit", "Rafic Hariri is assassinated",
                  "Baalbek festival", "The Litani river", "Camille Chamoun takes office"):
            self.assertTrue(h.lebanon_match(t), t)
        for t in ("A tyre blowout kills driver", "Israel strikes Gaza", "The Maronite church in Cyprus opens", "Amal Clooney speaks"):
            self.assertFalse(h.lebanon_match(t), t)
        self.assertTrue(h.lebanon_match("Druze and Maronite clashes spread"))
        self.assertTrue(h.lebanon_match("Maronite massacre", 1860))
        self.assertFalse(h.lebanon_match("Maronite massacre", 1990))
        self.assertTrue(h.lebanon_match("The city of Tyre is besieged"))

    def test_pass_all_pages(self):
        items = h.items_from_page("en.wikipedia.org", "2024 in Lebanon", "== Events ==\n=== May ===\n* 3 May – A small fire breaks out in a market.\n")
        self.assertEqual(len(items), 1)  # 'YYYY in Lebanon' items all pass the filter


class Ids(unittest.TestCase):
    def test_stable(self):
        a = h.candidate_id("2006-07-12", "Hezbollah kidnaps two soldiers.")
        b = h.candidate_id("2006-07-12", "  hezbollah   KIDNAPS two soldiers ")
        self.assertEqual(a, b)
        self.assertEqual(len(a), 12)
        self.assertNotEqual(a, h.candidate_id("2006-07-13", "Hezbollah kidnaps two soldiers."))
        self.assertNotEqual(a, h.candidate_id("2006-07-12", "Hezbollah kidnaps three soldiers."))


class Table(unittest.TestCase):
    def test_rows(self):
        tx = ('== 19th century ==\n{| class="wikitable"\n! Year || Date || Event\n|-\n| [[1860s|1860]] || 9 July || Damascus riots follow the Mount Lebanon conflict.\n'
              '|-\n| rowspan="2" | [[1880s|1888]] || || Beirut becomes the capital of a vilayet in the Ottoman Empire.\n|-\n| || March || A second event in the same year here.\n|}\n')
        items = h.table_items(tx, "Timeline of Lebanese history", "timeline")
        self.assertEqual([(i["date"], i["prec"]) for i in items], [("1860-07-09", "day"), ("1888", "year"), ("1888-03", "month")])


class Prose(unittest.TestCase):
    TXT = ("== History ==\nOn 13 April 1975, gunmen ambushed a bus in Ain el-Rummaneh, killing 27 Palestinians, which many consider the start of the war.<ref>{{cite web|url=https://e.com/bus}}</ref> "
           "The war lasted until 1990 and left over 100,000 dead. In March 1978 Israel invaded the south of the country in Operation Litani.\n"
           "== References ==\nOn 1 May 2000 something referenced here that must be skipped entirely because of the heading.\n")

    def test_article_sentences(self):
        items = h.items_from_page("en.wikipedia.org", "Lebanese Civil War", self.TXT, hint="article")
        self.assertEqual([(i["date"], i["prec"]) for i in items], [("1975-04-13", "day"), ("1978-03", "month")])
        self.assertEqual(items[0]["refs"], ["https://e.com/bus"])
        self.assertTrue(items[0]["text"].startswith("On 13 April 1975, gunmen"))

    def test_carry_year_in_protest_page(self):
        txt = "A man was shot and killed during a protest on 19 October 2019 in Beirut, the first death of the uprising in the country. Protesters blocked roads on 20 October across Lebanon as the cabinet met in the capital.\n"
        items = h.items_from_page("en.wikipedia.org", "17 October Revolution", txt)
        self.assertEqual([i["date"] for i in items], ["2019-10-19", "2019-10-20"])


class Dedupe(unittest.TestCase):
    def test_date_compat(self):
        self.assertTrue(h.date_compat("2006-07-12", "2006-07-14"))
        self.assertFalse(h.date_compat("2006-07-12", "2006-07-15"))
        self.assertTrue(h.date_compat("2006-07-12", "2006-07"))
        self.assertFalse(h.date_compat("2006-07-31", "2006-08"))
        self.assertTrue(h.date_compat("2006-07-12", "2006"))
        self.assertFalse(h.date_compat("2006", "2007"))

    def test_overlap(self):
        a = h.terms("Hezbollah kidnaps two Israeli soldiers on the border")
        b = h.terms("Hezbollah raid captures two Israeli soldiers")
        c = h.terms("Parliament approves the state budget")
        self.assertGreaterEqual(h.overlap(a, b), h.OVERLAP_MIN)
        self.assertEqual(h.overlap(a, c), 0.0)

    def test_track_map(self):
        self.assertEqual(h.map_track("Political/war", "Israel strikes a car, killing two"), "war")
        self.assertEqual(h.map_track("Political/war", "Parliament elects a speaker"), "politics")
        self.assertEqual(h.map_track("Economic", "x"), "economy")


if __name__ == "__main__":
    unittest.main()
