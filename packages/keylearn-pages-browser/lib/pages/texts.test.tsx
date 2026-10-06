import { test } from "node:test";
import { FakeIntlProvider } from "@keylearn/intl";
import { type PageData, PageDataContext } from "@keylearn/pages-shared";
import { FakeSettingsContext } from "@keylearn/settings";
import { Toaster } from "@keylearn/widget";
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { equal, isNotNull, isNull } from "rich-assert";
import TextsPage from "./texts.tsx";

function renderAs(id: string | null) {
  return render(
    <PageDataContext.Provider value={{ publicUser: { id } } as PageData}>
      <FakeIntlProvider>
        <FakeSettingsContext>
          <MemoryRouter initialEntries={["/texts"]}>
            <Routes>
              <Route path="/texts" element={<TextsPage />} />
              <Route path="*" element={<p>practice page</p>} />
            </Routes>
          </MemoryRouter>
          <Toaster />
        </FakeSettingsContext>
      </FakeIntlProvider>
    </PageDataContext.Provider>,
  );
}

/** The "Practise this" button on the card titled `title`. */
const go = (r: ReturnType<typeof render>, title: string) =>
  r.getByText(title).closest("article")!.querySelector("button")!;

test("a guest may only open guided practice", async () => {
  const r = renderAs(null);

  equal(go(r, "Code snippets").getAttribute("aria-disabled"), "true");
  equal(go(r, "Treasure Island").getAttribute("aria-disabled"), "true");
  equal(go(r, "Guided practice").getAttribute("aria-disabled"), null);

  // Locked: it stays on this page and says why.
  fireEvent.click(go(r, "Code snippets"));
  isNotNull(await r.findByText("Sign in to choose what you practise."));
  isNull(r.queryByText("practice page"));

  fireEvent.click(go(r, "Guided practice"));
  isNotNull(r.queryByText("practice page"));

  r.unmount();
});

test("an account holder may open any practice", () => {
  const r = renderAs("abc");

  equal(go(r, "Code snippets").getAttribute("aria-disabled"), null);
  fireEvent.click(go(r, "Code snippets"));
  isNotNull(r.queryByText("practice page"));

  r.unmount();
});
