import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/claude";
import { listPromptHistory } from "@/lib/prompt-history";
import { PromptForm } from "../PromptForm";

export const dynamic = "force-dynamic";

export default async function DashboardPromptPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const [{ data: account }, history] = await Promise.all([
    supabase.from("accounts").select("custom_system_prompt").eq("id", accountId).single(),
    listPromptHistory(accountId),
  ]);

  if (!account) redirect("/");

  return (
    <section>
      <h2 className="text-lg font-semibold">Sistem Promptu</h2>
      <PromptForm initialCustomPrompt={account.custom_system_prompt} defaultPrompt={DEFAULT_SYSTEM_PROMPT} history={history} />
    </section>
  );
}
