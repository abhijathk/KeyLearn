// Naming a day in a sentence, in languages where the nominative will not do.
//
// `toLocaleDateString(locale, { weekday: "long" })` returns the dictionary
// form — Finnish "tiistai", Hungarian "kedd", Polish "wtorek". That is the
// right answer to "what is this day called" and the wrong one to "when does
// this happen", which in these languages is a different word: "tiistaina",
// "kedden", "we wtorek".
//
// Every message that drops a weekday into a sentence hits this. The support
// desk's close deadline is the one that surfaced it — thirteen catalogues had
// to fall back to apposition, setting the day beside the sentence rather than
// in it, because no wording can inflect a word the formatter has not
// inflected. Intl has no API for this: there is no `case` option on
// DateTimeFormat, and the CLDR data behind it does not carry the forms.
//
// So the forms live here. Only for languages that need them — a locale absent
// from this table gets the formatter's own answer, which is correct for the
// large majority including English, German, French and every CJK locale.

/** Days as `Date.getDay()` numbers them: 0 is Sunday. */
type Week = readonly [string, string, string, string, string, string, string];

/**
 * The adverbial ("on <day>") form, by locale.
 *
 * Keyed by the base language rather than the full tag: none of these
 * languages varies this by region, and matching on the base means a
 * `sr-Latn` or an `hr-BA` still finds its entry.
 *
 * The phrase includes whatever preposition the language requires, because in
 * several of them the preposition and the case are one choice — Polish "we
 * wtorek" but "w środę" — and splitting them across a catalogue string and a
 * formatter is how they drift apart.
 */
const ADVERBIAL: Readonly<Record<string, Week>> = {
  // Any language omitted here falls through to the formatter, which is the
  // correct behaviour rather than a gap. Sunday first, as `Date.getDay()`
  // numbers the week.

  // Finnish: essive, no preposition.
  fi: [
    "sunnuntaina",
    "maanantaina",
    "tiistaina",
    "keskiviikkona",
    "torstaina",
    "perjantaina",
    "lauantaina",
  ],

  // Estonian: adessive, no preposition. "reede" is the one day whose
  // stem is not a -päev compound, so it takes a bare -l.
  et: [
    "pühapäeval",
    "esmaspäeval",
    "teisipäeval",
    "kolmapäeval",
    "neljapäeval",
    "reedel",
    "laupäeval",
  ],

  // Hungarian: superessive, no preposition, with vowel harmony picking
  // the suffix. "vasárnap" is already adverbial and takes none at all.
  hu: [
    "vasárnap",
    "hétfőn",
    "kedden",
    "szerdán",
    "csütörtökön",
    "pénteken",
    "szombaton",
  ],

  // Latvian: the bare adverbial form, no preposition. Lowercase here even
  // though the formatter capitalises its standalone names.
  lv: [
    "svētdien",
    "pirmdien",
    "otrdien",
    "trešdien",
    "ceturtdien",
    "piektdien",
    "sestdien",
  ],

  // Lithuanian: accusative, no preposition.
  lt: [
    "sekmadienį",
    "pirmadienį",
    "antradienį",
    "trečiadienį",
    "ketvirtadienį",
    "penktadienį",
    "šeštadienį",
  ],

  // Czech: "v" + accusative, vocalised to "ve" before the st- and čt-
  // clusters.
  cs: [
    "v neděli",
    "v pondělí",
    "v úterý",
    "ve středu",
    "ve čtvrtek",
    "v pátek",
    "v sobotu",
  ],

  // Slovak: "v" + accusative, vocalised to "vo" before št-. Unlike Czech,
  // Slovak keeps the bare "v" before str-.
  sk: [
    "v nedeľu",
    "v pondelok",
    "v utorok",
    "v stredu",
    "vo štvrtok",
    "v piatok",
    "v sobotu",
  ],

  // Polish: "w" + accusative, vocalised to "we" before wt- only.
  pl: [
    "w niedzielę",
    "w poniedziałek",
    "we wtorek",
    "w środę",
    "w czwartek",
    "w piątek",
    "w sobotę",
  ],

  // Russian: "в" + accusative, vocalised to "во" before вт-.
  ru: [
    "в воскресенье",
    "в понедельник",
    "во вторник",
    "в среду",
    "в четверг",
    "в пятницу",
    "в субботу",
  ],

  // Ukrainian: "у" + accusative. The у/в alternation is euphonic and turns
  // on the preceding sound, which a table cannot see; "у" is the form that
  // reads correctly in every position.
  uk: [
    "у неділю",
    "у понеділок",
    "у вівторок",
    "у середу",
    "у четвер",
    "у п’ятницю",
    "у суботу",
  ],

  // Croatian: "u" + accusative.
  hr: [
    "u nedjelju",
    "u ponedjeljak",
    "u utorak",
    "u srijedu",
    "u četvrtak",
    "u petak",
    "u subotu",
  ],

  // Slovene: "v" + accusative. The vocalised "ve" appears only before v-
  // and f-, which no weekday begins with.
  sl: [
    "v nedeljo",
    "v ponedeljek",
    "v torek",
    "v sredo",
    "v četrtek",
    "v petek",
    "v soboto",
  ],

  // Icelandic: "á" + accusative with the suffixed article, which is what
  // names a specific upcoming day rather than the day in general.
  is: [
    "á sunnudaginn",
    "á mánudaginn",
    "á þriðjudaginn",
    "á miðvikudaginn",
    "á fimmtudaginn",
    "á föstudaginn",
    "á laugardaginn",
  ],
};

/**
 * A weekday as it should read inside a sentence.
 *
 * Falls back to the platform formatter for any locale not in the table, and
 * for any date the table cannot answer — a missing entry must degrade to the
 * nominative, which is merely stiff, never to an empty string or a throw.
 */
export function weekdayInSentence(date: Date, locale: string): string {
  const base = locale.toLowerCase().split(/[-_]/)[0] ?? "";
  const week = ADVERBIAL[base];
  const form = week?.[date.getDay()];
  if (form != null && form !== "") {
    return form;
  }
  try {
    return date.toLocaleDateString(locale, { weekday: "long" });
  } catch {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
}

/** Whether this locale carries inflected forms, for tests and tooling. */
export function hasInflectedWeekdays(locale: string): boolean {
  return (locale.toLowerCase().split(/[-_]/)[0] ?? "") in ADVERBIAL;
}
