import { test } from "node:test";
import { DataDir } from "@keylearn/config";
import { PublicId } from "@keylearn/publicid";
import { equal, throws } from "rich-assert";
import { UserDataFactory } from "./index.ts";

test("get file name for user id", () => {
  const factory = new UserDataFactory(new DataDir("/keylearn"));

  equal(
    factory.getFile(new PublicId(1)).name,
    "/keylearn/user_stats/000/000/000000001",
  );
  equal(
    factory.getFile(new PublicId(123_456_789)).name,
    "/keylearn/user_stats/123/456/123456789",
  );
  throws(() => {
    factory.getFile(PublicId.example1);
  });
});
