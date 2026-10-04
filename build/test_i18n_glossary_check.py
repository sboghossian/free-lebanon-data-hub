"""Unit tests for build/i18n_glossary_check.py (the matcher, the number check, the queue split). Run: cd build && python3 -m unittest test_i18n_glossary_check"""
import json
import os
import tempfile
import unittest

import i18n_glossary_check as g

AR = g.Glossary("ar", {
    "Lebanon": {"canonical": "لبنان", "variants_ok": []},
    "Mount Lebanon": {"canonical": "جبل لبنان", "variants_ok": ["محافظة جبل لبنان"]},
    "Sidon": {"canonical": "صيدا", "variants_ok": []},
    "Saida": {"canonical": "صيدا", "variants_ok": []},
    "Tyre": {"canonical": "صور", "variants_ok": []},
    "Syrians": {"canonical": "السوريون", "variants_ok": []},
    "Druze": {"canonical": "الدروز", "variants_ok": []},
    "Cedar": {"canonical": "الأرز", "variants_ok": []},
    "Aoun's": {"canonical": "عون", "variants_ok": []},
    "Aoun": {"canonical": "عون", "variants_ok": []},
})
FR = g.Glossary("fr", {
    "Beirut": {"canonical": "Beyrouth", "variants_ok": ["Beirut"]},
    "Sidon": {"canonical": "Saïda", "variants_ok": ["Saida", "Sidon"]},
    "Tyre": {"canonical": "Tyr", "variants_ok": ["Sour"]},
    "Cairo": {"canonical": "Le Caire", "variants_ok": []},
    "Lebanon": {"canonical": "Liban", "variants_ok": []},
    "Mount Lebanon": {"canonical": "Mont-Liban", "variants_ok": []},
    "Israel": {"canonical": "Israël", "variants_ok": []},
    "Druze": {"canonical": "Druzes", "variants_ok": []},
    "L'Orient Today": {"canonical": "L'Orient Today", "variants_ok": []},
})


def load_glossary(lang):
    with open(os.path.join(g.I18N, f"glossary-{lang}.json"), encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


class TermsInEnglish(unittest.TestCase):
    def test_whole_word_only(self):
        self.assertEqual(FR.terms_in("Beirut and Beirutville"), ["Beirut"])
        self.assertEqual(FR.terms_in("Tyrell"), [])
        self.assertEqual(FR.terms_in("a sour tyre"), [])   # case-sensitive: the city is capitalised

    def test_longest_match_hides_the_shorter_term(self):
        self.assertEqual(AR.terms_in("Mount Lebanon and Lebanon"), ["Mount Lebanon", "Lebanon"])
        self.assertEqual(AR.terms_in("Mount Lebanon"), ["Mount Lebanon"])

    def test_possessive_and_curly_apostrophe(self):
        self.assertEqual(AR.terms_in("Aoun’s visit"), ["Aoun's"])
        self.assertEqual(AR.terms_in("Lebanon's army"), ["Lebanon"])
        self.assertEqual(FR.terms_in("L’Orient Today reported"), ["L'Orient Today"])


class ArabicMatching(unittest.TestCase):
    def test_canonical_present(self):
        self.assertEqual(AR.missing("Lebanon", "الجيش في لبنان"), [])

    def test_missing_reports_term_canonical_and_variants(self):
        m = AR.missing("Mount Lebanon", "منطقة الجبل")
        self.assertEqual(m, [{"term": "Mount Lebanon", "canonical": "جبل لبنان", "variants_ok": ["محافظة جبل لبنان"]}])

    def test_variant_accepted(self):
        self.assertEqual(AR.missing("Mount Lebanon", "محافظة جبل لبنان"), [])

    def test_clitic_prefixes_and_suffix(self):
        for t in ("في صيدا", "بصيدا", "وبصيدا", "لصيدا", "أهل صيدا", "صيدا."):
            self.assertEqual(AR.missing("Sidon", t), [], t)

    def test_short_form_must_be_a_token(self):
        self.assertEqual(AR.missing("Tyre", "التقطت صورة للميناء"), [{"term": "Tyre", "canonical": "صور", "variants_ok": []}])   # صورة = picture
        self.assertEqual(AR.missing("Tyre", "غارة على صور"), [])
        self.assertEqual(AR.missing("Tyre", "في مدينة صور الساحلية"), [])
        self.assertEqual(AR.missing("Aoun", "تصريح عون"), [])
        self.assertEqual(AR.missing("Aoun", "تصريحات العونيين")[0]["term"], "Aoun")

    def test_diacritics_alef_and_tatweel_ignored(self):
        self.assertEqual(AR.missing("Cedar", "شجرة الأَرْز"), [])
        self.assertEqual(AR.missing("Cedar", "شجرة الارز"), [])

    def test_article_may_drop(self):
        self.assertEqual(AR.missing("Cedar", "غابة أرز"), [])

    def test_case_ending_of_the_sound_plural(self):
        self.assertEqual(AR.missing("Syrians", "اللاجئين السوريين"), [])
        self.assertEqual(AR.missing("Syrians", "اللاجئون السوريون"), [])

    def test_modifier_forms_of_derived_keys(self):
        self.assertEqual(AR.missing("Druze", "الحزب الدرزي"), [])
        self.assertEqual(AR.missing("Druze", "القرى الدرزية"), [])
        self.assertEqual(AR.missing("Druze", "قرية جبلية")[0]["term"], "Druze")

    def test_two_keys_one_canonical_gives_one_row(self):
        self.assertEqual(len(AR.missing("Sidon (Saida)", "في المدينة")), 1)

    def test_untranslated_english_is_flagged(self):
        self.assertEqual(AR.missing("Lebanon Insights", "Lebanon Insights: مواصفات")[0]["term"], "Lebanon")


class FrenchMatching(unittest.TestCase):
    def test_canonical_and_variant_and_case(self):
        self.assertEqual(FR.missing("Beirut", "À Beyrouth"), [])
        self.assertEqual(FR.missing("Beirut", "à beyrouth"), [])
        self.assertEqual(FR.missing("Beirut", "Beirut Today"), [])   # accepted variant
        self.assertEqual(FR.missing("Beirut", "Bayrouth")[0]["canonical"], "Beyrouth")

    def test_accents_matter(self):
        self.assertEqual(FR.missing("Sidon", "à Saida"), [])   # listed variant
        self.assertEqual(FR.missing("Sidon", "à Saïda"), [])
        self.assertEqual(FR.missing("Israel", "Israel a déclaré")[0]["term"], "Israel")   # Israel without the diaeresis is not Israël

    def test_word_boundary(self):
        self.assertEqual(FR.missing("Tyre", "dans le Tyrol")[0]["term"], "Tyre")
        self.assertEqual(FR.missing("Tyre", "frappe sur Tyr"), [])
        self.assertEqual(FR.missing("Lebanon", "Liban-Sud"), [])

    def test_hyphen_and_apostrophe_variants(self):
        self.assertEqual(FR.missing("Mount Lebanon", "le Mont‑Liban"), [])
        self.assertEqual(FR.missing("L'Orient Today", "selon L’Orient Today"), [])

    def test_au_du_for_le(self):
        self.assertEqual(FR.missing("Cairo", "au Caire"), [])
        self.assertEqual(FR.missing("Cairo", "sommet du Caire"), [])
        self.assertEqual(FR.missing("Cairo", "Le Caire"), [])
        self.assertEqual(FR.missing("Cairo", "à Alexandrie")[0]["term"], "Cairo")

    def test_adjective_and_plural(self):
        self.assertEqual(FR.missing("Lebanon", "frontière libano-syrienne"), [])
        self.assertEqual(FR.missing("Lebanon", "l'armée libanaise"), [])
        self.assertEqual(FR.missing("Israel", "accord israélo-libanais"), [])
        self.assertEqual(FR.missing("Druze", "communauté druze"), [])
        self.assertEqual(FR.missing("Druze", "les Druzes"), [])


class Numbers(unittest.TestCase):
    def miss(self, en, tr, lang="fr", spelled=0):
        return g.numbers_missing(en, tr, lang, spelled)

    def test_present(self):
        self.assertEqual(self.miss("27 killed in 1975", "27 morts en 1975"), [])

    def test_missing(self):
        self.assertEqual(self.miss("27 killed in 1975", "morts en 1975"), ["27"])

    def test_separators_ignored(self):
        self.assertEqual(self.miss("1,234,567 people", "1 234 567 personnes"), [])
        self.assertEqual(self.miss("1,234,567 people", "1 234 567 personnes"), [])
        self.assertEqual(self.miss("3.5 percent", "3,5 %"), [])
        self.assertEqual(self.miss("1,234.5", "1.234,5"), [])
        self.assertEqual(self.miss("1,234,567 people", "١٬٢٣٤٬٥٦٧ شخص", "ar"), [])
        self.assertEqual(self.miss("3.5 percent", "٣٫٥ في المئة", "ar"), [])

    def test_arabic_indic_and_persian_digits(self):
        self.assertEqual(self.miss("In 1975, 27 died", "في ١٩٧٥ مات ٢٧", "ar"), [])
        self.assertEqual(self.miss("In 1975", "در ۱۹۷۵", "ar"), [])

    def test_wrong_number_is_missing(self):
        self.assertEqual(self.miss("1,234 dead", "1,243 morts"), ["1234"])

    def test_a_list_is_not_one_number(self):
        self.assertEqual(self.miss("in 2020,2021 and 2022", "en 2020, 2021 et 2022"), [])

    def test_sentence_final_decimal(self):
        self.assertEqual(self.miss("USD x 1507.5.", "USD x 1 507,5."), [])
        self.assertEqual(self.miss("by 1,000, as agreed", "de 1 000, comme convenu"), [])

    def test_range_second_year_may_be_written_in_full(self):
        self.assertEqual(self.miss("the 1989-90 wars", "les guerres de 1989-1990"), [])
        self.assertEqual(self.miss("held in 1952/53", "en 1952/1953", "ar"), [])
        self.assertEqual(self.miss("the 1989-90 wars", "les guerres de 1989"), ["90"])

    def test_iso_date_month_is_a_word_but_year_and_day_stay(self):
        self.assertEqual(self.miss("from 1980-07-20", "du 20 juillet 1980"), [])
        self.assertEqual(self.miss("from 1980-07-20", "en juillet 1980"), ["20"])
        self.assertEqual(self.miss("corrected from 2023-09", "corrigé depuis septembre 2023"), [])

    def test_time_on_the_hour(self):
        self.assertEqual(self.miss("at 17:00", "à 17 h"), [])
        self.assertEqual(self.miss("at 17:30", "à 17 h"), ["30"])

    def test_decades_are_words(self):
        self.assertEqual(self.miss("in the 1980s", "في الثمانينيات", "ar"), [])
        self.assertEqual(self.miss("the '90s", "les années quatre-vingt-dix"), [])

    def test_thousands_as_words(self):
        self.assertEqual(self.miss("about 280,000 emigrants", "نحو 280 ألف مهاجر", "ar"), [])
        self.assertEqual(self.miss("about 280,000 emigrants", "nombre d'émigrants"), ["280000"])
        self.assertEqual(self.miss("by 1,000 troops", "بألف جندي", "ar"), [])

    def test_ordinals_are_words_in_arabic_only(self):
        self.assertEqual(self.miss("the 15th term", "الولاية الخامسة عشرة", "ar"), [])
        self.assertEqual(self.miss("the 15th term", "la législature"), ["15"])

    def test_small_numbers_threshold(self):
        self.assertEqual(self.miss("2 killed", "deux morts", spelled=10), [])
        self.assertEqual(self.miss("2 killed", "deux morts", spelled=0), ["2"])
        self.assertEqual(self.miss("12 killed", "douze morts", spelled=10), ["12"])

    def test_leading_zeros_and_repeats(self):
        self.assertEqual(self.miss("2020 and again 2020", "2020"), [])
        self.assertEqual(self.miss("Term 007", "Mandat 7"), [])

    def test_codes_with_digits_survive(self):
        self.assertEqual(self.miss("ERA5 grid", "grille ERA5"), [])
        self.assertEqual(self.miss("ERA5 grid", "grille ERA"), ["5"])


class SplitAndSources(unittest.TestCase):
    def row(self, h, f):
        return {"h": h, "file": f, "en": "", "current": "", "expected": [], "numbers_missing": []}

    def test_split_by_hash_range_when_files_do_not_overlap(self):
        rows = [self.row("0a", "p1"), self.row("1a", "p1"), self.row("8a", "p2"), self.row("9a", "p2")]
        a, b, how = g.split_two(rows)
        self.assertTrue(how.startswith("hash range"))
        self.assertEqual(sorted(r["file"] for r in a), ["p1", "p1"])
        self.assertEqual(sorted(r["file"] for r in b), ["p2", "p2"])

    def test_split_by_file_when_ranges_overlap_and_no_file_is_shared(self):
        rows = [self.row("00", "research/p1"), self.row("90", "research/p1"), self.row("10", "research/p2"), self.row("95", "research/p2"),
                self.row("20", "research/p3"), self.row("99", "research/p3")]
        a, b, how = g.split_two(rows)
        self.assertTrue(how.startswith("by file"))
        self.assertEqual(len(a) + len(b), 6)
        self.assertFalse({r["file"] for r in a} & {r["file"] for r in b})

    def test_empty(self):
        self.assertEqual(g.split_two([])[:2], ([], []))

    def test_effective_translation_follows_build_order(self):
        with tempfile.TemporaryDirectory() as d:
            i18n, ui = os.path.join(d, "i18n"), os.path.join(d, "ui")
            os.makedirs(os.path.join(i18n, "fr"))
            os.makedirs(ui)
            en = "Beirut port"
            h = g.sha12(en)
            with open(os.path.join(i18n, "fr", "part-01.jsonl"), "w", encoding="utf-8") as f:
                f.write(json.dumps({"h": h, "t": "Port de Beirut"}) + "\n")
                f.write(json.dumps({"h": "ffffffffffff", "t": "stale"}) + "\n")   # not a source string: dropped, as the build drops it
                f.write("not json\n")
            write_json(os.path.join(ui, "ui_fixes.json"), {en: {"ar": "x", "fr": "Port de Beyrouth"}})
            eff, shadowed = g.effective("fr", {h: en}, i18n, ui)
            self.assertEqual(eff[h][0], "Port de Beyrouth")
            self.assertTrue(eff[h][1].endswith("ui_fixes.json"))
            self.assertEqual((len(eff), shadowed), (1, 1))

    def test_check_flags_terms_and_numbers_and_skips_interface_files(self):
        eff = {"a": ("Port de Beirut, 1 234 navires", "/x/research/i18n/fr/part-01.jsonl", "Beirut port, 1,234 ships"),
               "b": ("Beyrouth", "/x/build/i18n/ui_cost.json", "Beirut"),
               "c": ("Port de Beyrouth, 1 234 navires", "/x/build/i18n/ui_content.json", "Beirut port, 1,234 ships")}
        old = g.ROOT
        g.ROOT = "/x"
        try:
            rows, scanned, _ = g.check("fr", FR, eff)
        finally:
            g.ROOT = old
        self.assertEqual(scanned, 2)   # ui_cost.json is an interface file
        self.assertEqual([r["h"] for r in rows], [])   # "Beirut" is an accepted variant and 1 234 matches 1,234
        eff["a"] = ("Port de Bayrouth", "/x/research/i18n/fr/part-01.jsonl", "Beirut port, 1,234 ships")
        g.ROOT = "/x"
        try:
            rows, _, _ = g.check("fr", FR, eff)
        finally:
            g.ROOT = old
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["file"], "research/i18n/fr/part-01.jsonl")
        self.assertEqual(rows[0]["expected"][0]["canonical"], "Beyrouth")
        self.assertEqual(rows[0]["numbers_missing"], ["1234"])


class RealGlossaries(unittest.TestCase):
    def test_every_glossary_entry_matches_its_own_canonical_form(self):
        for lang in g.LANGS:
            gl = g.Glossary(lang, load_glossary(lang))
            bad = [k for k in gl.data if not gl.ok(k, gl.data[k]["canonical"])]
            self.assertEqual(bad, [], lang)
            bad = [(k, v) for k in gl.data for v in gl.data[k].get("variants_ok") or [] if not gl.ok(k, v)]
            self.assertEqual(bad, [], lang)

    def test_every_key_is_found_in_itself(self):
        for lang in g.LANGS:
            gl = g.Glossary(lang, load_glossary(lang))
            bad = [k for k in gl.data if k not in gl.terms_in(f"{k}") and not any(k in t for t in gl.terms_in(k))]
            self.assertEqual(bad, [], lang)


if __name__ == "__main__":
    unittest.main()
