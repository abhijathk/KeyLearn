import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import { allLocales, selectLocale } from "./locale.ts";
import { loadMessages } from "./messages.ts";

test("select locale", () => {
  const filter =
    (...found: string[]) =>
    (...locales: string[]) =>
      locales.find((locale) => found.includes(locale)) ?? null;
  equal(selectLocale(filter()), "en");
  equal(selectLocale(filter("xx")), "en");
  equal(selectLocale(filter("en")), "en");
  equal(selectLocale(filter("en-US")), "en");
  equal(selectLocale(filter("en-CA")), "en");
  equal(selectLocale(filter("pt")), "pt-br");
  equal(selectLocale(filter("pt-BR")), "pt-br");
  equal(selectLocale(filter("pt-PT")), "pt-pt");
  equal(selectLocale(filter("zh")), "zh-hans");
  equal(selectLocale(filter("zh-CN")), "zh-hans");
  equal(selectLocale(filter("zh-TW")), "zh-hant");
});

test("the runtime list, the loader and the shipped translations all agree", async () => {
  // These three drifted apart once and nothing complained: six languages —
  // Icelandic, Lithuanian, Mongolian, Bokmål, Slovene and Albanian — were
  // translated, compiled and shipped while being absent from `allLocales`, so
  // nobody could choose them. The build had no reason to object, because each
  // list was internally consistent.
  for (const locale of allLocales) {
    const messages = await loadMessages(locale);
    isTrue(
      Object.keys(messages).length > 0,
      `${locale} is offered but loads no messages`,
    );
  }
});
