import { Mail, RefreshCw, Check, X, Inbox } from "lucide-react";
import { relativeTimeTr } from "@/lib/format";
import { Card, Badge, Button } from "@/components/ui";
import { INBOUND_EMAIL_ENABLED } from "@/lib/inbound-email";
import { DisconnectGmailButton } from "./DisconnectGmailButton";
import { CopyAddressButton } from "./CopyAddressButton";
import { SetupGuideTabs } from "./SetupGuideTabs";
import { PrimarySourceButton } from "./PrimarySourceButton";

const GMAIL_CAPABILITIES = [
  { ok: true, text: "Belirlediğiniz konu başlıklarındaki mailleri okuma" },
  { ok: true, text: "Bu maillerin gönderen bilgisini ve gövdesini analiz etme" },
  { ok: false, text: "Mail göndermek — yapılamaz" },
  { ok: false, text: "Mail silmek veya arşivlemek — yapılamaz" },
];

export interface MailSourceConnection {
  connected_email: string;
  connected_at: string;
  disconnected_at: string | null;
}

export interface MailSourceAccount {
  lead_email_subjects: string[];
  primary_lead_source: string;
  inbound_last_received_at: string | null;
}

/** `/dashboard/gmail` sayfası ve Kurulum Paneli'nin "Mail Kaynağını Bağla" adımı tarafından paylaşılıyor. */
export function MailSourceContent({
  accountId,
  isOwner,
  connection,
  account,
  inboundAddress,
  returnTo = "/dashboard/gmail",
}: {
  accountId: string;
  isOwner: boolean;
  connection: MailSourceConnection | null;
  account: MailSourceAccount | null;
  inboundAddress: string | null;
  /** OAuth onayından sonra hangi sayfaya dönülecek — Kurulum Paneli içinden çağrılırken oraya, değilse Mail Kaynağı sayfasına. */
  returnTo?: "/dashboard/gmail" | "/dashboard/setup";
}) {
  const isConnected = !!connection && !connection.disconnected_at;
  const isForwardingPrimary = account?.primary_lead_source === "forwarding";

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Lead yakalama iki yöntemden biriyle (veya ikisiyle birden) çalışabilir — aynı anda ikisini de aktif tutabilirsiniz.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Sol kart: Gmail */}
        <Card className="flex flex-col p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Mail size={18} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Gmail ile Bağlan</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Salt okuma erişimi — filtrelerinizle eşleşen mailler doğrudan okunur, ayrıca bir yönlendirme kurmanıza gerek kalmaz.
                </p>
              </div>
            </div>
            <Badge variant="accent" className="shrink-0">
              Önerilen
            </Badge>
          </div>

          <ul className="mt-4 space-y-2">
            {GMAIL_CAPABILITIES.map((cap) => (
              <li key={cap.text} className="flex items-start gap-2 text-xs text-muted-foreground">
                {cap.ok ? (
                  <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                ) : (
                  <X size={14} className="mt-0.5 shrink-0 text-muted-foreground/60" />
                )}
                {cap.text}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex-1 border-t border-border pt-4">
            {connection ? (
              <>
                <p className="truncate text-sm font-medium text-foreground">{connection.connected_email}</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected
                    ? `Bağlandı: ${new Date(connection.connected_at).toLocaleString("tr-TR")}`
                    : "Bağlantı kaldırıldı — yeni mailler okunmuyor."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Henüz bağlı değil.</p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            {isOwner ? (
              <>
                <a href={`/api/oauth/gmail/start?accountId=${accountId}&returnTo=${encodeURIComponent(returnTo)}`}>
                  <Button variant="primary" size="sm">
                    <RefreshCw size={14} />
                    {isConnected ? "Yeniden Bağla" : "Gmail ile Bağlan"}
                  </Button>
                </a>
                {isConnected && <DisconnectGmailButton />}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sadece hesap sahibi Gmail bağlantısını değiştirebilir.</p>
            )}
          </div>
        </Card>

        {/* Sağ kart: Yönlendirme adresi */}
        <Card className="flex flex-col p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Inbox size={18} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Yönlendirme Adresi</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Gmail&apos;e hiç erişim vermeden çalışır — form bildirimlerinizin bir kopyası bu adrese gönderilir.
                </p>
              </div>
            </div>
            <Badge variant="accent" className="shrink-0">
              Aktif
            </Badge>
          </div>

          {inboundAddress && (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-hover px-3 py-2 text-xs text-foreground">
                  {inboundAddress}
                </code>
                <CopyAddressButton address={inboundAddress} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {account?.inbound_last_received_at ? (
                  <Badge variant="success">Son mail: {relativeTimeTr(account.inbound_last_received_at)}</Badge>
                ) : (
                  <Badge variant="neutral">Henüz mail alınmadı</Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground/80">
                Formunuzdan bu adrese Bcc/CC ile gönderilen bir kopya otomatik olarak lead&apos;e dönüştürülür.
              </p>
            </div>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kurulum Rehberi</p>
            <SetupGuideTabs />
          </div>

          <p className="mt-4 text-xs text-muted-foreground/80">
            Bcc kullanmak, formun mevcut alıcılarını değiştirmeden kopya gönderilmesini sağlar.
          </p>

          <div className="mt-4 flex-1" />

          {isOwner && (
            <div className="mt-4 border-t border-border pt-4">
              <PrimarySourceButton isPrimary={isForwardingPrimary} disabled={!INBOUND_EMAIL_ENABLED} />
            </div>
          )}
        </Card>
      </div>

      {account && (
        <p className="mt-4 text-xs text-muted-foreground">
          Lead e-postası başlıkları:{" "}
          {account.lead_email_subjects.map((subject, i) => (
            <span key={subject}>
              {i > 0 && " veya "}
              <code className="rounded bg-surface-hover px-1 py-0.5">{subject}</code>
            </span>
          ))}{" "}
          — değiştirmek için{" "}
          <a href="/dashboard/settings" className="text-accent hover:underline">
            Ayarlar
          </a>
          &apos;a bakın.
        </p>
      )}
    </>
  );
}
