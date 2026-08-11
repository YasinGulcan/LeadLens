import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { resolveAuthenticatedDestination } from "@/lib/auth-redirect";
import { AuthCard } from "../AuthCard";
import { LoginFlow } from "./LoginFlow";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSessionInfo();
  if (session) {
    const destination = await resolveAuthenticatedDestination(session);
    if (destination) redirect(destination);
  }

  return (
    <AuthCard>
      <LoginFlow />
    </AuthCard>
  );
}
