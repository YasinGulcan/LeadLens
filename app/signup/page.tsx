import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { resolveAuthenticatedDestination } from "@/lib/auth-redirect";
import { getActivePricingPlans } from "@/lib/pricing";
import { AuthCard } from "../AuthCard";
import { SignupFlow } from "./SignupFlow";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const session = await getSessionInfo();
  if (session) {
    const destination = await resolveAuthenticatedDestination(session);
    if (destination) redirect(destination);
  }

  const { plan: planId } = await searchParams;
  const preselectedPlan = planId ? (await getActivePricingPlans()).find((p) => p.id === planId) : undefined;

  return (
    <AuthCard>
      <SignupFlow preselectedPlan={preselectedPlan ? { id: preselectedPlan.id, name: preselectedPlan.name } : null} />
    </AuthCard>
  );
}
