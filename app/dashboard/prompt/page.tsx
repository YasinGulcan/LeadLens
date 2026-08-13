import { redirect } from "next/navigation";

export default function DashboardPromptPage() {
  redirect("/dashboard/settings?tab=prompt");
}
