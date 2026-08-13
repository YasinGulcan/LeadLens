import { AuthCard } from "../../AuthCard";
import { InviteCallbackFlow } from "./InviteCallbackFlow";

export const dynamic = "force-dynamic";

export default function InviteCallbackPage() {
  return (
    <AuthCard>
      <InviteCallbackFlow />
    </AuthCard>
  );
}
