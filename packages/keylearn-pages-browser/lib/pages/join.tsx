import { JoinPage } from "@keylearn/page-org";
import { useParams } from "react-router";

// The invite link's landing page. The token in the path is the only way
// to get here, and it is what tells the page which organisation and role
// are on offer.
export default function Page() {
  const { token } = useParams<{ token: string }>();
  return <JoinPage token={token ?? ""} />;
}
