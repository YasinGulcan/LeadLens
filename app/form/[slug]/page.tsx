import { notFound } from "next/navigation";
import { getAccountBySlug } from "@/lib/accounts";
import { LeadForm } from "./LeadForm";

export const dynamic = "force-dynamic";

export default async function AccountLeadFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const account = await getAccountBySlug(slug);
  if (!account || account.status === "disabled") notFound();

  return <LeadForm accountSlug={slug} />;
}
