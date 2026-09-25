import { test } from "node:test";
import { textDisplaySettings, toLine } from "@keylearn/textinput";
import { render } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { equal } from "rich-assert";
import { TextArea } from "./TextArea.tsx";

test("render empty text", () => {
  const r = render(
    <IntlProvider locale="en">
      <TextArea
        settings={textDisplaySettings}
        lines={{ text: "", lines: [] }}
      />
    </IntlProvider>,
  );

  equal(shownText(r.container), "");

  r.unmount();
});

test("render simple text", () => {
  const r = render(
    <IntlProvider locale="en">
      <TextArea
        settings={textDisplaySettings}
        lines={{ text: "abcxyz", lines: [toLine("abc"), toLine("xyz")] }}
      />
    </IntlProvider>,
  );

  equal(shownText(r.container), "abcxyz");

  r.unmount();
});

test("render styled text", () => {
  const r = render(
    <IntlProvider locale="en">
      <TextArea
        settings={textDisplaySettings}
        lines={{
          text: "abcxyz",
          lines: [
            toLine({ text: "abc", cls: "keyword" }),
            toLine({ text: "xyz", cls: "comment" }),
          ],
        }}
      />
    </IntlProvider>,
  );

  equal(shownText(r.container), "abcxyz");

  r.unmount();
});

test("render text with line template", () => {
  const r = render(
    <IntlProvider locale="en">
      <TextArea
        settings={textDisplaySettings}
        lines={{ text: "abcxyz", lines: [toLine("abc"), toLine("xyz")] }}
        lineTemplate={({ children }) => <div>[{children}]</div>}
      />
    </IntlProvider>,
  );

  equal(shownText(r.container), "[abc][xyz]");

  r.unmount();
});

/**
 * What the lesson shows, without the screen-reader-only way-out hint the
 * textarea is described by.
 */
function shownText(container: HTMLElement): string | null {
  const copy = container.cloneNode(true) as HTMLElement;
  const hint = container
    .querySelector("textarea")
    ?.getAttribute("aria-describedby");
  if (hint != null) {
    copy.querySelector(`[id="${hint}"]`)?.remove();
  }
  return copy.textContent;
}
