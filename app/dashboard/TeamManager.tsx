"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "./useConfirm";
import { Card, Button, Badge } from "@/components/ui";

/** Sunucu beklenmedik şekilde çökerse (boş/HTML gövdeli 500 vb.) res.json() ham bir JS hatasıyla patlamasın diye. */
async function safeJson(res: Response): Promise<{ error?: string }> {
  try {
    return await res.json();
  } catch {
    return { error: `Sunucu hatası (${res.status})` };
  }
}

export interface TeamMemberRow {
  id: string;
  email: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export function TeamManager({
  isOwner,
  ownerEmail,
  members,
  pendingOwnerEmail,
}: {
  isOwner: boolean;
  ownerEmail: string | null;
  members: TeamMemberRow[];
  pendingOwnerEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [cancellingTransfer, setCancellingTransfer] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage(`Davet gönderildi: ${email}`);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(id: string, accepted: boolean) {
    const message = accepted
      ? "Bu kişiyi ekipten çıkarmak istediğinize emin misiniz?"
      : "Bu daveti iptal etmek istediğinize emin misiniz?";
    if (!(await confirm(message, { danger: true }))) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/dashboard/team/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Çıkarma başarısız oldu.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleTransfer(id: string, memberEmail: string) {
    const ok = await confirm(
      `"${memberEmail}" adresine sahiplik devri daveti gönderilsin mi? O kişi kendi Gmail'ini bağladığında hesabın yeni sahibi olur, siz otomatik olarak sıradan bir ekip üyesine dönüşürsünüz.`
    );
    if (!ok) return;
    setTransferringId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/dashboard/team/${id}/transfer`, { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage(`Sahiplik devri daveti gönderildi: ${memberEmail}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setTransferringId(null);
    }
  }

  async function handleCancelTransfer() {
    setCancellingTransfer(true);
    try {
      const res = await fetch("/api/dashboard/team/transfer", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("İptal başarısız oldu.");
    } finally {
      setCancellingTransfer(false);
    }
  }

  return (
    <div>
      {pendingOwnerEmail && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span>
            <strong>{pendingOwnerEmail}</strong> adresine sahiplik devri gönderildi, kabul etmesi bekleniyor.
          </span>
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={handleCancelTransfer} disabled={cancellingTransfer} className="ml-3">
              {cancellingTransfer ? "İptal ediliyor..." : "İptal Et"}
            </Button>
          )}
        </div>
      )}

      {isOwner ? (
        <form onSubmit={handleInvite} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">E-posta ile davet et</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ekip-arkadasi@gmail.com"
              className="mt-1 w-72 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              required
            />
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Gönderiliyor..." : "Davet Et"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Sadece hesap sahibi yeni ekip üyesi davet edebilir.</p>
      )}

      {message && <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}

      <Card className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">E-posta</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Durum</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ownerEmail && (
              <tr>
                <td className="px-4 py-2 text-foreground">
                  <Link href={`/dashboard/team/${encodeURIComponent(ownerEmail)}`} className="hover:text-accent hover:underline">
                    {ownerEmail}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Badge variant="accent">Sahip</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">—</td>
                <td className="px-4 py-2" />
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-foreground">
                  {m.acceptedAt ? (
                    <Link href={`/dashboard/team/${encodeURIComponent(m.email)}`} className="hover:text-accent hover:underline">
                      {m.email}
                    </Link>
                  ) : (
                    m.email
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="neutral">Üye</Badge>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {m.acceptedAt ? (
                    `Katıldı: ${new Date(m.acceptedAt).toLocaleString("tr-TR")}`
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400" title={`Davet: ${new Date(m.invitedAt).toLocaleString("tr-TR")}`}>
                      Davet edildi (bekliyor)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTransfer(m.id, m.email)}
                        disabled={transferringId === m.id || !!pendingOwnerEmail || !m.acceptedAt}
                        title={!m.acceptedAt ? "Sahiplik ancak daveti kabul edip en az bir kez giriş yapan üyelere devredilebilir." : undefined}
                      >
                        {transferringId === m.id ? "Gönderiliyor..." : "Sahipliği Devret"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleRemove(m.id, !!m.acceptedAt)} disabled={removingId === m.id}>
                        {removingId === m.id ? "Çıkarılıyor..." : m.acceptedAt ? "Çıkar" : "Daveti İptal Et"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Henüz davet edilen ekip üyesi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {dialog}
    </div>
  );
}
