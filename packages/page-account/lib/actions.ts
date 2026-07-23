import { catchError } from "@keybr/debug";
import { type AnyUser, type UserDetails } from "@keybr/pages-shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { checkoutProduct } from "./checkout.ts";
import { AccountService, type PatchAccountRequest } from "./service.ts";

export type AccountActions = {
  readonly patchAccount: (request: PatchAccountRequest) => void;
  readonly deleteAccount: () => void;
  readonly logout: () => void;
  readonly checkout: () => void;
};

export function useAccountActions(props: {
  user: UserDetails;
  publicUser: AnyUser;
}) {
  const { formatMessage } = useIntl();
  const [{ user, publicUser }, setState] = useState(props);

  const patchAccount = (request: PatchAccountRequest) => {
    AccountService.patchAccount(request)
      .then(({ user, publicUser }) => {
        setState({ user, publicUser });
      })
      .catch(catchError);
  };

  const deleteAccount = () => {
    const message = formatMessage({
      id: "account.deleteAccount.message",
      defaultMessage:
        "Delete your account for good? " +
        "This can't be undone — " +
        "though you're always welcome to create a new account later.",
    });
    if (window.confirm(message)) {
      AccountService.deleteAccount()
        .then(() => {
          reload("/");
        })
        .catch(catchError);
    }
  };

  const logout = () => {
    reload("/auth/logout");
  };

  const checkout = () => {
    checkoutProduct(user).catch(catchError);
  };

  return {
    user,
    publicUser,
    actions: {
      patchAccount,
      deleteAccount,
      logout,
      checkout,
    } as AccountActions,
  };
}

function reload(path: string) {
  window.location.href = path;
}
