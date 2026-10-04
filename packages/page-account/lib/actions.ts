import { catchError } from "@keylearn/debug";
import {
  type AnyUser,
  clearAllProfileStorage,
  logout,
  type UserDetails,
} from "@keylearn/pages-shared";
import { useState } from "react";
import { checkoutProduct } from "./checkout.ts";
import { useParentPinGate } from "./pin-gate.tsx";
import {
  AccountService,
  type DeleteMethods,
  type DeleteProof,
  type PatchAccountRequest,
} from "./service.ts";

export type AccountActions = {
  readonly patchAccount: (request: PatchAccountRequest) => Promise<void>;
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
  // Renaming the account or changing what is public sits behind the
  // grown-up PIN on the server (428); this asks for it and replays.
  const pinGate = useParentPinGate();

  /**
   * Returns its promise so a caller can say what went wrong.
   *
   * It used to swallow every failure into the console: a rejected rename
   * — a name already taken, a validation error — left the field silently
   * reverting to the old value with nothing on screen. From the outside
   * that is indistinguishable from "saving does nothing", which is
   * exactly how it was reported.
   */
  const patchAccount = (request: PatchAccountRequest) => {
    // An empty patch is only a re-read after another card changed the
    // account. It is not worth a PIN prompt nobody asked for.
    const refreshOnly = Object.keys(request).length === 0;
    const run = () => AccountService.patchAccount(request);
    return (refreshOnly ? run() : pinGate.gated(run))
      .then(({ user, publicUser }) => {
        setState({ user, publicUser });
      })
      .catch((err) => {
        catchError(err);
        throw err;
      });
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
      // The account is gone from the server; it has to be gone from the device
      // too. Without this the next person to open KeyLearn on this machine is
      // met by the last family's best scores and sticker album, and "delete my
      // account" turns out to have meant one of the two places it was kept.
      // After the server has confirmed, and before the reload that would
      // otherwise leave the old data sitting there.
      clearAllProfileStorage();
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
    /** The grown-up PIN prompt, while a change waits on it. Render it. */
    pinPrompt: pinGate.prompt,
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
