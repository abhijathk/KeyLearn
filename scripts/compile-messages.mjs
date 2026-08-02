// Recompiles lib/messages/*.json from translations/*.json without touching
// POEditor. `translate.js` does this too, but only after an extract and a
// remote sync that need credentials this task does not have.
import { compile } from "@formatjs/cli-lib";
import { readJsonSync, writeJsonSync } from "./lib/fs-json.js";
import { messageIdHash } from "./lib/intl.js";
import {
  mergedTranslationsPath,
  messagesPath,
  translationsPath,
} from "./lib/intl-io.js";
import { allLocales, defaultLocale } from "./locale.js";

const remap = (entries, cb) =>
  Object.fromEntries(Object.entries(entries).map(cb));

const defaultTranslations = readJsonSync(translationsPath(defaultLocale));
const format = {
  compile: (translations) =>
    remap(translations, ([id, message]) => [messageIdHash(id), message]),
};

for (const locale of allLocales) {
  const translations = readJsonSync(translationsPath(locale));
  const mergedFile = mergedTranslationsPath(locale);
  writeJsonSync(
    mergedFile,
    remap(defaultTranslations, ([id, message]) => [
      id,
      translations[id] || message,
    ]),
  );
  writeJsonSync(
    messagesPath(locale),
    JSON.parse(await compile([mergedFile], { ast: true, format })),
    null,
  );
}
console.log("compiled messages for", allLocales.length, "locales");
