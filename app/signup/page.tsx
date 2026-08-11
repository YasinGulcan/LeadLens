import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { resolveAuthenticatedDestination } from "@/lib/auth-redirect";
import { AuthCard } from "../AuthCard";
import { SignupFlow } from "./SignupFlow";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSessionInfo();
  if (session) {
    const destination = await resolveAuthenticatedDestination(session);
    if (destination) redirect(destination);
  }

  return (
    <AuthCard>
      <SignupFlow />
    </AuthCard>
  );
}
