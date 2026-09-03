import { Pages } from "@keylearn/pages-shared";
import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router";
import * as styles from "./ComingSoon.module.less";

/**
 * What a page shows while the control centre has it set to "coming soon".
 *
 * The two off states differ in exactly one way, and it is this: a page set
 * to 404 is gone, link and all, while a page set to coming soon keeps its
 * link and lands the visitor here. So this is deliberately not an error
 * screen — the visitor did nothing wrong and the link was not stale. It
 * sits inside the normal chrome, says the page is not open yet, and offers
 * the way back.
 */
export function ComingSoon(): ReactNode {
  return (
    <div className={styles.root}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden={true}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9.5V13l2.2 1.6" />
        <path d="M9 2.5h6" />
      </svg>
      <h1 className={styles.title}>
        <FormattedMessage
          id="page.comingSoon.title"
          defaultMessage="Coming soon"
        />
      </h1>
      <p className={styles.text}>
        <FormattedMessage
          id="page.comingSoon.text"
          defaultMessage="This page is not open yet. It is on its way — try again before long, and nothing you have already done is affected."
        />
      </p>
      <Link className={styles.back} to={Pages.practice.path}>
        <FormattedMessage
          id="page.comingSoon.back"
          defaultMessage="Back to practice"
        />
      </Link>
    </div>
  );
}
