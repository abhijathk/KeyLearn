import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { render } from "@testing-library/react";
import { includes } from "rich-assert";
import { Book } from "./book.ts";
import { BookPreview } from "./BookPreview.tsx";

test("render", () => {
  const r = render(
    <FakeIntlProvider>
      <BookPreview
        book={Book.EN_WIZARD_OZ}
        content={[["chapter", ["one", "two", "three"]]]}
      />
    </FakeIntlProvider>,
  );

  includes(r.container.textContent!, "Chapter count:1");
  includes(r.container.textContent!, "Paragraph count:3");
  includes(r.container.textContent!, "Total words:3");
  includes(r.container.textContent!, "Distinct words:3");
  includes(r.container.textContent!, "Characters:11");

  r.unmount();
});
