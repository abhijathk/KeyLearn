import { test } from "node:test";
import { NotFoundError } from "@fastr/errors";
import { Manifest, ManifestContext } from "@keylearn/assets";
import { FakeIntlProvider } from "@keylearn/intl";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "react-intl";
import { deepEqual, equal, isNull, isTrue, like } from "rich-assert";
import { ErrorPage, inspectError } from "./ErrorPage.tsx";

test("render", () => {
  const html = renderToStaticMarkup(
    <ManifestContext.Provider value={Manifest.fake}>
      <FakeIntlProvider>
        <ErrorPage
          error={{
            expose: true,
            status: 400,
            message: "Bad Request",
          }}
        />
      </FakeIntlProvider>
    </ManifestContext.Provider>,
  );

  const $ = load(html);

  like($("html").attr(), {
    "lang": "en",
    "dir": "ltr",
    "data-color": "auto",
    "data-font": "roboto",
  });
  equal($("title").text(), "400 – Bad Request");
  isTrue($("body").text().includes("400 – Bad Request"));
  isTrue(
    $("body").text().includes("Request contained invalid data or parameters."),
  );
  isTrue($("body").text().includes("Start over"));
  isTrue($("body").text().includes("Technical details"));
});

test("render in the provider's language", () => {
  const html = renderToStaticMarkup(
    <ManifestContext.Provider value={Manifest.fake}>
      <IntlProvider locale="ar" defaultLocale="en" onError={() => {}}>
        <ErrorPage
          error={{
            expose: true,
            status: 404,
            message: "Not Found",
          }}
        />
      </IntlProvider>
    </ManifestContext.Provider>,
  );

  const $ = load(html);

  like($("html").attr(), { lang: "ar", dir: "rtl" });
});

test("inspect error", () => {
  // @ts-expect-error Test invalid arguments.
  isNull(inspectError(undefined));
  // @ts-expect-error Test invalid arguments.
  isNull(inspectError(null));
  // @ts-expect-error Test invalid arguments.
  isNull(inspectError(""));
  // @ts-expect-error Test invalid arguments.
  isNull(inspectError([]));
  // @ts-expect-error Test invalid arguments.
  isNull(inspectError({}));
  // @ts-expect-error Test invalid arguments.
  deepEqual(inspectError({ message: "omg" }), {
    message: "omg",
    status: 500,
    expose: false,
    description: null,
  });
  deepEqual(inspectError(new NotFoundError()), {
    message: "Not Found",
    status: 404,
    expose: true,
    description: null,
  });
  deepEqual(
    inspectError(
      new NotFoundError("OMG", {
        expose: false,
        description: "Page not found",
      }),
    ),
    {
      message: "OMG",
      status: 404,
      expose: false,
      description: "Page not found",
    },
  );
});
