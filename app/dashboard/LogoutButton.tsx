"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleClick() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleClick} className="text-sm text-neutral-500 hover:underline">
      Çıkış yap
    </button>
  );
}
