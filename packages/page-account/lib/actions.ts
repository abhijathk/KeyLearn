import { catchError } from "@keybr/debug";
import { type AnyUser, type UserDetails } from "@keybr/pages-shared";
import { useState } from "react";
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
  const [{ user, publicUser }, setState] = useState(props);

  const patchAccount = (request: PatchAccountRequest) => {
    AccountService.patchAccount(request)
      .then(({ user, publicUser }) => {
        setState({ user, publicUser });
      })
      .catch(catchError);
  };

  // Confirmation now happens in a custom dialog on the account page, so these
  // just perform the action.
  const deleteAccount = () => {
    AccountService.deleteAccount()
      .then(() => {
        reload("/");
      })
      .catch(catchError);
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
