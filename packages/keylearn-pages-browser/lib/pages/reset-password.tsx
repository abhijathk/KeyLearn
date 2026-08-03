import { AuthPage } from "@keylearn/page-account";
import { useParams } from "react-router";

export default function Page() {
  const { token = "" } = useParams();
  return <AuthPage mode="reset" token={token} />;
}
