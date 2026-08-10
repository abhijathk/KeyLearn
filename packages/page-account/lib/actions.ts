import { catchError } from "@keylearn/debug";
import { type AnyUser, logout, type UserDetails } from "@keylearn/pages-shared";
import { useState } from "react";
import { checkoutProduct } from "./checkout.ts";
import {
  AccountService,
  type DeleteMethods,
  type DeleteProof,
  type PatchAccountRequest,
} from "./service.ts";

export type AccountActions = {
  readonly patchAccount: (request: PatchAccountRequest) => void;
  readonly sendDeleteAccountCode: () => Promise<void>;
  readonly deleteAccountMethods: () => Promise<DeleteMethods>;
  readonly deleteAccountPasskeyProof: () => Promise<DeleteProof>;
  readonly deleteAccount: (
    proof: DeleteProof,
    keepStats: boolean,
  ) => Promise<void>;
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

  // Confirmation happens in a custom dialog on the account page (a code is
  // emailed and entered there), so these just perform the action. deleteAccount
  // returns its promise so the dialog can surface a wrong-code error.
  const sendDeleteAccountCode = () => AccountService.sendDeleteAccountCode();
  const deleteAccountMethods = () => AccountService.deleteAccountMethods();
  const deleteAccountPasskeyProof = () =>
    AccountService.deleteAccountPasskeyProof();
  const deleteAccount = (proof: DeleteProof, keepStats: boolean) =>
    AccountService.deleteAccount(proof, keepStats).then(() => {
      reload("/");
    });

  const doLogout = () => {
    void logout();
  };

  const checkout = () => {
    checkoutProduct(user).catch(catchError);
  };

  return {
    user,
    publicUser,
    actions: {
      patchAccount,
      sendDeleteAccountCode,
      deleteAccountMethods,
      deleteAccountPasskeyProof,
      deleteAccount,
      logout: doLogout,
      checkout,
    } as AccountActions,
  };
}

function reload(path: string) {
  window.location.href = path;
}
