import { Pages } from "@keybr/pages-shared";
import { Navigate } from "react-router";

// Profiles now live inside the account page; keep the old path working.
export default function Page() {
  return <Navigate to={Pages.account.path} replace={true} />;
}
