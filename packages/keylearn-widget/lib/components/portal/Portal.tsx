import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { querySelector } from "../../utils/query.ts";
import * as styles from "./Portal.module.less";

export function Portal({
  children,
  key,
}: {
  readonly children: ReactNode;
  readonly key?: null | string;
}): ReactNode {
  // The container is rendered by the page template, and this portal is not
  // entitled to assume it won: a page rendered without the template — a test,
  // a storybook, an embed — used to crash its ENTIRE tree here, because a
  // throw during render has no boundary to land in. The body is where the
  // container itself lives, so falling back to it keeps the one property a
  // portal exists for: escaping the ancestors' overflow and stacking.
  return createPortal(
    children,
    PortalContainer.tryQuery() ?? document.body,
    key,
  );
}

export function PortalContainer(): ReactNode {
  return <div id={PortalContainer.id} />;
}

PortalContainer.id = styles.root;

PortalContainer.query = () => querySelector(`#${PortalContainer.id}`);

/** The container if it is mounted, or null — never a throw. */
PortalContainer.tryQuery = (): Element | null =>
  document.getElementById(PortalContainer.id);
