import { test } from "node:test";
import { parseColor } from "@keylearn/color";
import { deepEqual, equal } from "rich-assert";
import { UrlAsset } from "./asset.ts";
import { CustomTheme } from "./custom-theme.ts";
import { readTheme, storeTheme } from "./theme-io.ts";

test("store", async () => {
  // Arrange.

  const storage = new FakeStorage([
    ["keylearn.theme[--accent]", "rgb(255 255 255)"],
  ]);

  const theme = new CustomTheme()
    .set("--primary", parseColor("#ffffff"))
    .set("--secondary", parseColor("#000000"))
    .set("--background-image", new UrlAsset("/assets/image.svg"));

  // Act.

  const { error } = await storeTheme(theme, storage);

  // Assert.

  equal(error, null);
  deepEqual(
    [...storage],
    [
      ["keylearn.theme[--primary]", "rgb(255 255 255)"],
      ["keylearn.theme[--secondary]", "rgb(0 0 0)"],
      ["keylearn.theme[--background-image]", "/assets/image.svg"],
    ],
  );
});

test("read", async () => {
  // Arrange.

  const storage = new FakeStorage([
    ["keylearn.theme[--primary]", "rgb(255 255 255)"],
    ["keylearn.theme[--secondary]", "rgb(0 0 0)"],
    ["keylearn.theme[--background-image]", "/assets/image.svg"],
  ]);

  // Act.

  const { theme, error } = await readTheme(storage);

  // Assert.

  equal(error, null);
  deepEqual(theme.get("--primary"), parseColor("#ffffff"));
  deepEqual(theme.get("--secondary"), parseColor("#000000"));
  deepEqual(theme.get("--background-image"), new UrlAsset("/assets/image.svg"));
});

test("read and ignore invalid data", async () => {
  // Arrange.

  const storage = new FakeStorage([
    ["keylearn.theme[--primary]", "omg"],
    ["keylearn.theme[--secondary]", "omg"],
    ["keylearn.theme[--background-image]", "data:omg"],
  ]);

  // Act.

  const { theme, error } = await readTheme(storage);

  // Assert.

  deepEqual([...storage], []);
  deepEqual([...theme], []);
  equal(error?.errors.length, 3);
});

class FakeStorage implements Storage, Iterable<[string, string]> {
  readonly #data: Map<string, string>;

  constructor(items: Iterable<[string, string]> = []) {
    this.#data = new Map(items);
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.#data.entries();
  }

  key(index: number): string | null {
    throw new TypeError();
  }

  get length(): number {
    throw new TypeError();
  }

  clear(): void {
    this.#data.clear();
  }

  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.#data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }
}
