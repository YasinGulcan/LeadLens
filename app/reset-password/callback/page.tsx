import { AuthCard } from "../../AuthCard";
import { ResetPasswordCallbackFlow } from "./ResetPasswordCallbackFlow";

export const dynamic = "force-dynamic";

export default function ResetPasswordCallbackPage() {
  return (
    <AuthCard>
      <ResetPasswordCallbackFlow />
    </AuthCard>
  );
}
