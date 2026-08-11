import { test } from "node:test";
import { equal, isFalse, isTrue } from "rich-assert";
import {
  classicCourseActive,
  courseNamespace,
  courseOf,
} from "./profile-storage.ts";

function prefs(profileId: string, value: unknown): void {
  localStorage.setItem(
    `profile-${profileId}.kids.prefs`,
    JSON.stringify(value),
  );
}

test("the guided history keeps the name it has always had", () => {
  // Anything else would move every existing learner's history the day this
  // shipped, and a course split is not a migration.
  equal(courseNamespace("19"), "profile-19");
  equal(courseNamespace("19", "guided"), "profile-19");
  equal(courseNamespace("19", "classic"), "profile-19.classic");
});

test("a learner is on guided practice until they are put on Classic", () => {
  localStorage.clear();
  equal(courseOf("19"), "guided");
  isFalse(classicCourseActive("19"));
  prefs("19", { classic: false });
  equal(courseOf("19"), "guided");
  prefs("19", { classic: true });
  equal(courseOf("19"), "classic");
  isTrue(classicCourseActive("19"));
});

test("a learner is asked about by name, not by who is at the keyboard", () => {
  localStorage.clear();
  prefs("8", { classic: true });
  prefs("9", { classic: false });
  // The parent reading the course page is not the child on Classic.
  equal(courseOf("8"), "classic");
  equal(courseOf("9"), "guided");
});

test("unreadable preferences mean guided, not a broken page", () => {
  localStorage.clear();
  localStorage.setItem("profile-19.kids.prefs", "{ this is not json");
  equal(courseOf("19"), "guided");
});
