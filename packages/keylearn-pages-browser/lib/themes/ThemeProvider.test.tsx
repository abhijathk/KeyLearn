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

  // The theme is stored as well as cookied, so it now outlives a test. Clear
  // it: without this each test inherits the last one's learner, and the one
  // that checks a corrupt cookie would silently be checking a good stored
  // theme instead.
  localStorage.clear();

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
      "%2C%22textSize%22%3A%22medium%22%2C%22accent%22%3A%22keylearn%22%7D",
  );
  equal(document.documentElement.dataset["color"], "keylearn-day");
  equal(document.documentElement.dataset["font"], "spectral");

  // Act.

  await userEvent.click(r.getByText("open-sans"));

  // Assert.

  equal(
    document.cookie,
    "prefs=%7B%22color%22%3A%22keylearn-day%22%2C%22font%22%3A%22open-sans%22" +
      "%2C%22textSize%22%3A%22medium%22%2C%22accent%22%3A%22keylearn%22%7D",
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

test("a theme set on another device wins over this device's cookie", async () => {
  // Arrange. This is what a learner's other laptop leaves behind: the mirror
  // has pulled their choice into storage, and this browser's cookie still
  // holds whatever was last picked here.
  localStorage.setItem(
    "keylearn.theme",
    '{"color":"keylearn-day","font":"open-sans","textSize":"medium",' +
      '"accent":"keylearn"}',
  );

  // Act.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Assert. The cookie is brought into line with the stored choice, so the
  // next server-rendered page already paints it rather than serving the old
  // theme and flashing to this one once the client takes over.
  equal(
    document.cookie,
    "prefs=%7B%22color%22%3A%22keylearn-day%22%2C%22font%22%3A%22open-sans%22" +
      "%2C%22textSize%22%3A%22medium%22%2C%22accent%22%3A%22keylearn%22%7D",
  );
  // And it is the theme the app is actually wearing, not merely one it wrote
  // down: the cookie is repaired from the same value the provider mounted on.
  equal(r.getByTestId("applied").textContent, "keylearn-day/open-sans");

  // Cleanup.

  r.unmount();
});

test("a theme chosen here is stored, so it can follow the learner", async () => {
  // Arrange.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Act.

  await userEvent.click(r.getByText("keylearn-day"));

  // Assert. The cookie is this device's cache; the stored copy is the one the
  // mirror carries to the learner's other devices. Both have to be written,
  // and a cookie without a stored copy is the bug this covers.
  const stored = localStorage.getItem("keylearn.theme");
  equal(typeof stored, "string");
  equal(JSON.parse(stored!)["color"], "keylearn-day");

  // Cleanup.

  r.unmount();
});

test("a theme already chosen before it could travel is copied across once", () => {
  // Arrange. Everyone who set a theme before this existed holds a cookie and
  // nothing else. Left alone their choice would never leave this machine.
  equal(localStorage.getItem("keylearn.theme"), null);

  // Act.

  const r = render(
    <ThemeProvider>
      <Switcher />
    </ThemeProvider>,
  );

  // Assert.

  const stored = localStorage.getItem("keylearn.theme");
  equal(typeof stored, "string");
  equal(JSON.parse(stored!)["color"], "dark");
  equal(JSON.parse(stored!)["font"], "spectral");

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
  const { color, font, switchColor, switchFont, switchAccent } = useTheme();
  return (
    <div>
      <span data-testid="applied">
        {color}/{font}
      </span>
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
