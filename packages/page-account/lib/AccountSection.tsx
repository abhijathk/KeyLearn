import {
  type AnyUser,
  isPremiumUser,
  type UserDetails,
  UserName,
} from "@keybr/pages-shared";
import { Article, Button, CheckBox, FieldSet, Icon, Para } from "@keybr/widget";
import { mdiCreditCard, mdiDeleteForever, mdiExitToApp } from "@mdi/js";
import { FormattedMessage, useIntl } from "react-intl";
import { AccountName } from "./AccountName.tsx";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { type AccountActions } from "./actions.ts";

export function AccountSection({
  user,
  publicUser,
  actions,
}: {
  user: UserDetails;
  publicUser: AnyUser;
  actions: AccountActions;
}) {
  const { formatMessage } = useIntl();

  return (
    <Article>
      <AccountName user={user} />

      <FormattedMessage
        id="account.accountPage.description"
        defaultMessage="<p>Your typing data is backed up to the cloud through your account, so your profile follows you to any computer or browser you use.</p>"
      />

      <FieldSet
        legend={formatMessage({
          id: "t_Account_details",
          defaultMessage: "Account settings",
        })}
      >
        <Para>
          <UserName user={publicUser} />
        </Para>

        <Para>
          <FormattedMessage
            id="account.avatar.description"
            defaultMessage="This image and name are shown publicly — on your profile, the high scores table, and in multiplayer games."
          />
        </Para>

        <Para>
          <CheckBox
            label={formatMessage({
              id: "t_Anonymize_me",
              defaultMessage: "Hide my identity",
            })}
            checked={user.anonymized}
            onChange={() => {
              actions.patchAccount({ anonymized: !user.anonymized });
            }}
          />
        </Para>

        <Para>
          <FormattedMessage
            id="account.anonymize.description"
            defaultMessage="Turning this on swaps your real image and name for one we generate for you. Toggle it on or off as often as you like."
          />
        </Para>

        <Para>
          <Button
            onClick={() => {
              actions.logout();
            }}
            icon={<Icon shape={mdiExitToApp} />}
            label={formatMessage({
              id: "t_Sing_out",
              defaultMessage: "Log out",
            })}
          />
        </Para>
      </FieldSet>

      <FieldSet
        legend={formatMessage({
          id: "t_Premium_account",
          defaultMessage: "Premium membership",
        })}
      >
        {isPremiumUser(publicUser) ? (
          <FormattedMessage
            id="account.premiumAccount.description"
            defaultMessage="<p>Thanks for upgrading to premium membership! Enjoy the extra features and a fully ad-free experience.</p>"
          />
        ) : (
          <>
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

            <Para>
              <Button
                onClick={() => {
                  actions.checkout();
                }}
                icon={<Icon shape={mdiCreditCard} />}
                label={formatMessage({
                  id: "t_Buy_a_premium_",
                  defaultMessage: "Upgrade to premium",
                })}
              />
            </Para>
          </>
        )}
      </FieldSet>

      <FieldSet
        legend={formatMessage({
          id: "t_Delete_account",
          defaultMessage: "Remove account",
        })}
      >
        <Para>
          <Button
            onClick={() => {
              actions.deleteAccount();
            }}
            icon={<Icon shape={mdiDeleteForever} />}
            label={formatMessage({
              id: "t_Delete_account",
              defaultMessage: "Remove account",
            })}
          />
        </Para>

        <Para>
          <FormattedMessage
            id="account.deleteAccount.description"
            defaultMessage="This permanently erases identifying information — your name and email — from our database. This can't be reversed! Looking to just reset your typing stats and start fresh instead? You can do that from the profile page."
          />
        </Para>
      </FieldSet>
    </Article>
  );
}
