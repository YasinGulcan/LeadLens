"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartyPopper } from "lucide-react";

/** Onboarding tamamlandığında `/dashboard?welcome=1`'e yönlendiriliyor — burada bir kez gösterilip URL'den temizleniyor, sayfa yenilemede tekrar çıkmaz. */
export function WelcomeToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldShow = searchParams.get("welcome") === "1";
  const [visible, setVisible] = useState(shouldShow);

  useEffect(() => {
    if (!shouldShow) return;
    router.replace("/dashboard");
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-accent/30 bg-surface px-5 py-3 shadow-xl">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <PartyPopper size={16} className="text-accent" />
        14 günlük ücretsiz deneme süreniz başladı!
      </p>
    </div>
  );
}
