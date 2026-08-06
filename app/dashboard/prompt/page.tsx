import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/claude";
import { listSavedPrompts } from "@/lib/prompt-library";
import { PromptForm } from "../PromptForm";

export const dynamic = "force-dynamic";

export default async function DashboardPromptPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const [{ data: account }, savedPrompts] = await Promise.all([
    supabase.from("accounts").select("custom_system_prompt").eq("id", accountId).single(),
    listSavedPrompts(accountId),
  ]);

  if (!account) redirect("/");

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Sistem Promptu</h2>
      <PromptForm
        initialCustomPrompt={account.custom_system_prompt}
        defaultPrompt={DEFAULT_SYSTEM_PROMPT}
        savedPrompts={savedPrompts}
      />
    </section>
  );
}
