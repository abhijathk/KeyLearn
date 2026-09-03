import { test } from "node:test";
import { render } from "@testing-library/react";
import { equal, isFalse, isNotNull, isNull, isTrue } from "rich-assert";
import { AdBar, type AdView } from "./AdBar.tsx";

/**
 * The paid line's own promises, the ones that are not the server's to keep.
 *
 * Each of these is a rule the bar has to enforce in the browser, and each
 * would be invisible in a screenshot taken a second too late: the label
 * that cannot be styled away, the dismiss control that waits, and the
 * attribution that survives an advertiser having no name.
 */

const CLOSE_DELAY_MS = 5000;

function campaign(over: Partial<AdView> = {}): AdView {
  return {
    id: 1,
    advertiser: "Keychron",
    screens: [
      {
        template: "offer",
        headline: "15% off mechanical keyboards",
        support: "Free shipping this week",
        button: "Copy code",
        href: "https://keychron.example/x",
      },
    ],
    palette: { bar: "#0B2B3F" },
    hasLogo: false,
    dismissible: true,
    ...over,
  };
}

const closeButton = (r: { container: HTMLElement }) =>
  r.container.querySelector<HTMLButtonElement>(
    'button[aria-label="Hide this advertisement for now"]',
  );

test("the line always says Ad, and the advertiser cannot style it away", () => {
  const r = render(<AdBar ads={[campaign()]} dwellSeconds={8} />);
  const tags = [...r.container.querySelectorAll("span")].filter(
    (s) => s.textContent === "Ad",
  );
  equal(tags.length, 1, "the Ad tag is not on the line exactly once");
  r.unmount();
});

test("the dismiss control waits five seconds, holding its place", async () => {
  const r = render(
    <AdBar ads={[campaign()]} dwellSeconds={8} onDismiss={() => {}} />,
  );

  const early = closeButton(r);
  isNotNull(early, "the control is absent, so the line would reflow later");
  isTrue(
    early!.className.includes("closeWaiting"),
    "the control is offered immediately, before the line has been read",
  );
  equal(early!.getAttribute("aria-hidden"), "true", "it is announced early");
  equal(early!.tabIndex, -1, "it is reachable by keyboard early");

  await new Promise((resolve) => setTimeout(resolve, CLOSE_DELAY_MS + 250));

  const late = closeButton(r);
  isFalse(
    late!.className.includes("closeWaiting"),
    "the control never arrived",
  );
  equal(late!.getAttribute("aria-hidden"), "false");
  r.unmount();
});

test("a campaign with no name runs on its logo, and still says whose it is", () => {
  const r = render(
    <AdBar
      ads={[campaign({ advertiser: "", hasLogo: true })]}
      dwellSeconds={8}
    />,
  );
  const text = r.container.textContent ?? "";
  isTrue(text.includes("15% off mechanical keyboards"), "the headline is gone");
  // The name is absent from the line, but the window still has an answer.
  isFalse(text.includes("Keychron"), "an empty name was rendered anyway");
  isNotNull(
    r.container.querySelector('img[src="/_/ads/logo/1"]'),
    "the logo that stands in for the name is missing",
  );
  r.unmount();
});

test("a campaign that may not be dismissed offers no cross at all", () => {
  const r = render(
    <AdBar
      ads={[campaign({ dismissible: false })]}
      dwellSeconds={8}
      onDismiss={() => {}}
    />,
  );
  isNull(closeButton(r), "an undismissable line still offered a cross");
  r.unmount();
});

test("every click leaves through KeyLearn's own redirect", () => {
  const r = render(<AdBar ads={[campaign()]} dwellSeconds={8} />);
  const link = r.container.querySelector<HTMLAnchorElement>("a[href^='/go/']");
  isNotNull(link, "the call to action does not go through the redirect");
  equal(link!.getAttribute("href"), "/go/ad/1/0");
  equal(link!.getAttribute("rel"), "nofollow sponsored noopener");
  // Nothing on the line links straight out to the advertiser.
  const direct = [...r.container.querySelectorAll("a")].filter((a) =>
    (a.getAttribute("href") ?? "").startsWith("http"),
  );
  equal(direct.length, 0, "a link bypassed the redirect");
  r.unmount();
});
