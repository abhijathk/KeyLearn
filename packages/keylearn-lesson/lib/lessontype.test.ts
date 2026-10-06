import { test } from "node:test";
import { deepEqual } from "rich-assert";
import { LessonType } from "./lessontype.ts";

test("only guided practice is open to guests", () => {
  deepEqual(
    [...LessonType.ALL].filter((type) => type.openToGuests),
    [LessonType.GUIDED],
  );
});
