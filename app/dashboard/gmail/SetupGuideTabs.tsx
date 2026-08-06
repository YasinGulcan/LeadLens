"use client";

import { useState } from "react";

interface GuideTool {
  id: string;
  label: string;
  steps: string[];
}

const TOOLS: GuideTool[] = [
  {
    id: "cf7",
    label: "Contact Form 7",
    steps: [
      "WordPress panelinde İletişim > (formunuz) sayfasını açın.",
      "\"Posta\" (Mail) sekmesine geçin.",
      "\"Bcc\" alanına yönlendirme adresinizi yapıştırın.",
      "Kaydet'e basın — mevcut \"Kime\" (To) alanı değişmez, sadece bir kopya da bu adrese gider.",
    ],
  },
  {
    id: "wpforms",
    label: "WPForms",
    steps: [
      "WordPress panelinde WPForms > (formunuz) > Ayarlar > Bildirimler'i açın.",
      "İlgili bildirimi seçip \"Gelişmiş Alanları Göster\"e tıklayın.",
      "\"CC / BCC\" alanına yönlendirme adresinizi yapıştırın.",
      "Kaydet'e basın.",
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    steps: [
      "HubSpot'ta Pazarlama > Formlar'dan ilgili formu açın.",
      "Seçenekler sekmesinde \"Bildirimler\"i bulun.",
      "\"Ek bildirim alıcıları\" (Additional recipients) alanına yönlendirme adresinizi ekleyin.",
      "Değişiklikleri kaydedin.",
    ],
  },
  {
    id: "typeform",
    label: "Typeform",
    steps: [
      "Typeform'da formunuzu açıp Connect > Email Notifications'a gidin.",
      "\"Add recipient\" ile yeni bir alıcı ekleyin.",
      "Yönlendirme adresinizi girin.",
      "Kaydedip bir test gönderimiyle mailin ulaştığını doğrulayın.",
    ],
  },
];

export function SetupGuideTabs() {
  const [activeId, setActiveId] = useState(TOOLS[0].id);
  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveId(tool.id)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              active.id === tool.id
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <ol className="mt-3 space-y-2">
        {active.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-xs text-muted-foreground">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold text-foreground">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
