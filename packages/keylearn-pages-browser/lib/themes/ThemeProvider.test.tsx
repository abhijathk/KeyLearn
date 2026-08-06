import { test } from "node:test";
import { useTheme } from "@keylearn/themes";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { equal } from "rich-assert";
import { ThemeProvider } from "./ThemeProvider.tsx";

test.beforeEach(() => {
  window.matchMedia = (query) => {
    return new (class extends EventTarget {
      matches = false;
      media = query;
    })() as MediaQueryList;
  };
});

test.beforeEach(() => {
  document.documentElement.dataset["color"] = "dark";
  document.documentElement.dataset["font"] = "spectral";

  document.cookie =
    "prefs=%7B%22color%22%3A%22dark%22%2C%22font%22%3A%22spectral%22%7D";
});

test.afterEach(() => {
  document.documentElement.dataset["color"] = "";
  document.documentElement.dataset["font"] = "";
  document.documentElement.dataset["accent"] = "";
});

test("mount and switch styles", async () => {
  // Act.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Assert.

  equal(document.documentElement.dataset["color"], "dark");
  equal(document.documentElement.dataset["font"], "spectral");

  // Act.

  await userEvent.click(r.getByText("keylearn-day"));

  // Assert.

  equal(
    document.cookie,
    "prefs=%7B%22color%22%3A%22keylearn-day%22%2C%22font%22%3A%22spectral%22" +
      "%2C%22accent%22%3A%22keylearn%22%7D",
  );
  equal(document.documentElement.dataset["color"], "keylearn-day");
  equal(document.documentElement.dataset["font"], "spectral");

  // Act.

  await userEvent.click(r.getByText("open-sans"));

  // Assert.

  equal(
    document.cookie,
    "prefs=%7B%22color%22%3A%22keylearn-day%22%2C%22font%22%3A%22open-sans%22" +
      "%2C%22accent%22%3A%22keylearn%22%7D",
  );
  equal(document.documentElement.dataset["color"], "keylearn-day");
  equal(document.documentElement.dataset["font"], "open-sans");
  // A signed-out visitor has one accent and no way to change it.
  equal(document.documentElement.dataset["accent"], "keylearn");

  // Cleanup.

  r.unmount();
});

test("a signed-out visitor cannot wear another accent", async () => {
  // Arrange.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Act.

  await userEvent.click(r.getByText("sepia"));

  // Assert. The offer is visible in the account panel, but nothing is stored
  // and nothing repaints until there is an account to store it against.
  equal(document.documentElement.dataset["accent"], "keylearn");

  // Cleanup.

  r.unmount();
});

test("ignore invalid cookie value", () => {
  // Arrange.

  document.cookie = "prefs=%%%garbage%%%";

  // Act.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Assert.

  equal(document.cookie, "prefs=%%%garbage%%%");

  // Cleanup.

  r.unmount();
});

function Switcher() {
  const { switchColor, switchFont, switchAccent } = useTheme();
  return (
    <div>
      <button
        onClick={() => {
          switchColor("keylearn-day");
        }}
      >
        keylearn-day
      </button>
      <button
        onClick={() => {
          switchColor("dark");
        }}
      >
        dark
      </button>
      <button
        onClick={() => {
          switchFont("open-sans");
        }}
      >
        open-sans
      </button>
      <button
        onClick={() => {
          switchFont("spectral");
        }}
      >
        spectral
      </button>
      <button
        onClick={() => {
          switchAccent("sepia");
        }}
      >
        sepia
      </button>
    </div>
  );
}
