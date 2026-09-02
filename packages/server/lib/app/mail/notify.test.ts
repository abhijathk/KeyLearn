import { test } from "node:test";
import { deepEqual } from "rich-assert";
import { unsubscribeHeaders } from "./notify.ts";

test("opt-out mail carries a List-Unsubscribe pointing at the preferences page", () => {
  deepEqual(unsubscribeHeaders("https://www.keylearn.org/account#prefs"), {
    "List-Unsubscribe": "<https://www.keylearn.org/account#prefs>",
  });
});
