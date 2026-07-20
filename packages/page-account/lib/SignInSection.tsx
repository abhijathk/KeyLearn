import { Article, Header } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { AccountName } from "./AccountName.tsx";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { type SignInActions } from "./actions.ts";
import { EmailLoginForm } from "./EmailLoginForm.tsx";
import { OAuthLoginForm } from "./OAuthLoginForm.tsx";

export function SignInSection({ actions }: { actions: SignInActions }) {
  return (
    <Article>
      <AccountName user={null} />

      <FormattedMessage
        id="account.signInPage.description"
        defaultMessage={
          "<p>Create a free account to back up your typing data in the cloud, so you can pick up right where you left off on any device or browser. Skip the account, and your progress simply stays saved on this one computer.</p>" +
          "<p>We never store passwords ourselves — sign-in is handled through trusted third-party providers, giving you several quick ways to get started.</p>" +
          "<p>Change your mind later? Deleting your account is just as easy as creating it.</p>"
        }
      />

      <Header level={2}>
        <FormattedMessage
          id="t_Premium_account"
          defaultMessage="Premium membership"
        />
      </Header>

      <FormattedMessage
        id="account.freeAccount.description"
        defaultMessage={
          "<p>Upgrade to <strong>premium membership</strong> for extra features and a completely ad-free experience. Here's what you get:</p>" +
          "<ul>" +
          "<li><strong>Zero ads.</strong> No more distractions pulling your focus away from your practice.</li>" +
          "<li><strong>Zero trackers.</strong> Ads bring trackers along with them — remove both and browse with full privacy.</li>" +
          "<li><strong>Faster pages.</strong> Without ads to load, every page opens noticeably quicker.</li>" +
          "</ul>" +
          "<p>This is a one-time purchase that unlocks lifetime access — not a recurring subscription.</p>"
        }
      />

      <AccountPricePreview />

      <Header level={2}>
        <FormattedMessage
          id="t_Signin_with_social_"
          defaultMessage="Log in with a social account"
        />
      </Header>

      <OAuthLoginForm />

      <Header level={2}>
        <FormattedMessage
          id="t_Signin_with_email"
          defaultMessage="Log in with email"
        />
      </Header>

      <EmailLoginForm actions={actions} />
    </Article>
  );
}
