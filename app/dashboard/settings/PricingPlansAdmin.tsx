"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import { useConfirm } from "../useConfirm";
import type { PricingPlan, BillingPeriod, CtaType } from "@/lib/pricing";

const BILLING_LABEL: Record<BillingPeriod, string> = { monthly: "aylık", yearly: "yıllık" };
const CTA_TYPE_LABEL: Record<CtaType, string> = { signup: "Kayıt sayfasına", contact: "İletişime (mailto)" };

interface FormState {
  name: string;
  price: string;
  currency: string;
  billingPeriod: BillingPeriod;
  features: string[];
  isFeatured: boolean;
  ctaLabel: string;
  ctaType: CtaType;
}

const EMPTY_FORM: FormState = {
  name: "",
  price: "",
  currency: "TRY",
  billingPeriod: "monthly",
  features: [],
  isFeatured: false,
  ctaLabel: "Başlayın",
  ctaType: "signup",
};

function planToForm(plan: PricingPlan): FormState {
  return {
    name: plan.name,
    price: String(plan.price),
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    features: plan.features,
    isFeatured: plan.isFeatured,
    ctaLabel: plan.ctaLabel,
    ctaType: plan.ctaType,
  };
}

/** Hem "Yeni Plan Ekle" hem "Düzenle" için ortak form — sadece submit hedefi/metodu farklı. */
function PlanForm({
  initial,
  submitUrl,
  submitMethod,
  onCancel,
  onSaved,
}: {
  initial: FormState;
  submitUrl: string;
  submitMethod: "POST" | "PATCH";
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [newFeature, setNewFeature] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFeature() {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    setForm((f) => ({ ...f, features: [...f.features, trimmed] }));
    setNewFeature("");
  }

  function removeFeature(i: number) {
    setForm((f) => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(form.price.replace(",", "."));
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Ad ve geçerli bir fiyat zorunlu.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch(submitUrl, {
        method: submitMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim(), price, ctaLabel: form.ctaLabel.trim() || "Başlayın" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Plan Adı</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Fiyat</label>
          <div className="mt-1 flex gap-2">
            <input
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
              className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Dönem</label>
          <select
            value={form.billingPeriod}
            onChange={(e) => setForm((f) => ({ ...f, billingPeriod: e.target.value as BillingPeriod }))}
            className="mt-1 w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="monthly" className="bg-surface text-foreground">
              Aylık
            </option>
            <option value="yearly" className="bg-surface text-foreground">
              Yıllık
            </option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Buton Hedefi</label>
          <select
            value={form.ctaType}
            onChange={(e) => setForm((f) => ({ ...f, ctaType: e.target.value as CtaType }))}
            className="mt-1 w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="signup" className="bg-surface text-foreground">
              Kayıt sayfası
            </option>
            <option value="contact" className="bg-surface text-foreground">
              İletişim (mailto)
            </option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Buton Metni</label>
          <input
            value={form.ctaLabel}
            onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Önerilen plan (vurgulansın)
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Özellikler</label>
        {form.features.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {form.features.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {f}
                <button type="button" onClick={() => removeFeature(i)} aria-label="Kaldır" className="text-muted-foreground hover:text-danger">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFeature();
              }
            }}
            placeholder="Yeni özellik ekle ve Enter'a basın…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
          <Button type="button" variant="secondary" size="sm" disabled={!newFeature.trim()} onClick={addFeature}>
            Ekle
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function PricingPlansAdmin({ plans }: { plans: PricingPlan[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    setEditingId(null);
    setAdding(false);
    router.refresh();
  }

  async function toggleActive(plan: PricingPlan) {
    setBusyId(plan.id);
    try {
      await fetch(`/api/dashboard/pricing-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function move(plan: PricingPlan, direction: "up" | "down") {
    setBusyId(plan.id);
    try {
      await fetch(`/api/dashboard/pricing-plans/${plan.id}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(plan: PricingPlan) {
    if (!(await confirm(`"${plan.name}" planı kalıcı olarak silinsin mi?`, { danger: true }))) return;
    setBusyId(plan.id);
    try {
      await fetch(`/api/dashboard/pricing-plans/${plan.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Bu liste LeadLens&apos;in kendi (herkese açık) fiyatlandırma bölümünde görünür — hesaba özel değil, tüm ziyaretçiler için ortak.
      </p>

      {plans.map((plan, i) => (
        <Card key={plan.id} className="p-4">
          {editingId === plan.id ? (
            <PlanForm
              initial={planToForm(plan)}
              submitUrl={`/api/dashboard/pricing-plans/${plan.id}`}
              submitMethod="PATCH"
              onCancel={() => setEditingId(null)}
              onSaved={refresh}
            />
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  {plan.isFeatured && <Badge variant="accent">Önerilen</Badge>}
                  {!plan.isActive && <Badge variant="neutral">Pasif</Badge>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(plan, "up")}
                    disabled={i === 0 || busyId === plan.id}
                    aria-label="Yukarı taşı"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(plan, "down")}
                    disabled={i === plans.length - 1 || busyId === plan.id}
                    aria-label="Aşağı taşı"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(plan.id)}
                    aria-label="Düzenle"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(plan)}
                    disabled={busyId === plan.id}
                    aria-label="Sil"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.price} {plan.currency} / {BILLING_LABEL[plan.billingPeriod]} · {plan.features.length} özellik · {CTA_TYPE_LABEL[plan.ctaType]}
              </p>
              <button
                type="button"
                onClick={() => toggleActive(plan)}
                disabled={busyId === plan.id}
                className="mt-2 text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                {plan.isActive ? "Pasif yap" : "Aktif yap"}
              </button>
            </div>
          )}
        </Card>
      ))}

      {plans.length === 0 && !adding && <p className="text-sm text-muted-foreground">Henüz plan eklenmedi.</p>}

      {adding ? (
        <Card className="p-4">
          <PlanForm initial={EMPTY_FORM} submitUrl="/api/dashboard/pricing-plans" submitMethod="POST" onCancel={() => setAdding(false)} onSaved={refresh} />
        </Card>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={14} /> Yeni Plan Ekle
        </Button>
      )}
      {dialog}
    </div>
  );
}
