import { type ReactNode } from "react";
import { FormattedMessage } from "react-intl";
import * as styles from "./Profiles.module.less";

/**
 * The parental-consent notice a grown-up reads before creating a child
 * profile. Plain-English summary of what data is collected about a child, why,
 * and the parent's rights — the "readable consent document" behind the
 * checkbox. (Not legal advice; review with counsel before release.)
 */
export function ConsentDocument(): ReactNode {
  return (
    <div className={styles.consentDoc}>
      <h3>
        <FormattedMessage
          id="consent.heading"
          defaultMessage="Parental consent for a child’s profile"
        />
      </h3>
      <p>
        <FormattedMessage
          id="consent.intro"
          defaultMessage="KeyLearn is used by families, and some learners are children under 13. Before you create a child’s profile, please read and agree to the following."
        />
      </p>

      <h4>
        <FormattedMessage
          id="consent.collect.h"
          defaultMessage="What we collect about your child"
        />
      </h4>
      <ul>
        <li>
          <FormattedMessage
            id="consent.collect.1"
            defaultMessage="A first name (or nickname) and an avatar you choose."
          />
        </li>
        <li>
          <FormattedMessage
            id="consent.collect.2"
            defaultMessage="A birth year, used only to tune the words, pacing and look to their age."
          />
        </li>
        <li>
          <FormattedMessage
            id="consent.collect.3"
            defaultMessage="Their typing practice results (speed, accuracy, which keys they have learned) so progress is saved and can be shown back to them."
          />
        </li>
      </ul>

      <h4>
        <FormattedMessage id="consent.use.h" defaultMessage="How we use it" />
      </h4>
      <p>
        <FormattedMessage
          id="consent.use.p"
          defaultMessage="This information is used only to run the typing lessons and show progress. We do not sell it, we do not use it for advertising, and there are no third-party trackers. A child’s profile is stored under your account."
        />
      </p>

      <h4>
        <FormattedMessage id="consent.rights.h" defaultMessage="Your rights" />
      </h4>
      <p>
        <FormattedMessage
          id="consent.rights.p"
          defaultMessage="As the parent or guardian, you can view, edit or delete your child’s profile and its data at any time from this Account page. Deleting the profile (or your account) permanently removes the child’s data. You may withdraw consent at any time by deleting the profile."
        />
      </p>

      <p className={styles.consentAffirm}>
        <FormattedMessage
          id="consent.affirm"
          defaultMessage="By ticking the box, you confirm that you are the parent or legal guardian of this child and that you consent to KeyLearn collecting and using the information described above."
        />
      </p>
    </div>
  );
}
