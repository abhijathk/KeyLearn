import { test } from "node:test";
import { deepEqual } from "rich-assert";
import { snakeKeys } from "./raw-rows.ts";

test("rows read the same from MySQL (camelCase keys) and SQLite (snake_case keys)", () => {
  const mysql = [{ userId: 7, signupCountry: "AU", count: 2, at: "x" }];
  const sqlite = [{ user_id: 7, signup_country: "AU", count: 2, at: "x" }];
  const want = [{ user_id: 7, signup_country: "AU", count: 2, at: "x" }];
  deepEqual(snakeKeys(mysql), want);
  deepEqual(snakeKeys(sqlite), want);
  deepEqual(snakeKeys([]), []);
});
