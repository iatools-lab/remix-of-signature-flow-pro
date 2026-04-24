import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send as SendIcon, BellRing, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useBinders } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Binder } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sent")({
  head: () => ({
    meta: [
      { title: "Envoyés par moi — Usign" },
      {
        name: "description",
        content: "Suivi des parapheurs envoyés et des signatures en attente.",
      },
    ],
  }),
  component: SentPage,
});

type Filter = "all" | "pending" | "finished" | "stopped";

function SentPage() {
  const { t, i18n } = useTranslation();
  const { binders, remindSigner } = useBinders();
  const session = getSession();
  const email = (session?.email ?? "").toLowerCase();
  const [filter, setFilter] = useState<Filter>("all");
  const [remindedKey, setRemindedKey] = useState<string | null>(null);

  const items = useMemo<Binder[]>(() => {
    if (!email) return [];
    return binders
      .filter((b) => b.ownerEmail.toLowerCase() === email)
      .filter((b) => {
        if (filter === "all") return true;
        if (filter === "pending") return b.status === "started" || b.status === "draft";
        if (filter === "finished") return b.status === "finished" || b.status === "archived";
        if (filter === "stopped") return b.status === "stopped";
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [binders, email, filter]);

  const fmt = (iso: string) => formatDateTime(iso, i18n.language);

  const onRemind = (binderId: string, signerId: string) => {
    if (!session) return;
    remindSigner(binderId, signerId, { name: session.name, email: session.email });
    const key = `${binderId}:${signerId}`;
    setRemindedKey(key);
    setTimeout(() => setRemindedKey((k) => (k === key ? null : k)), 2000);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("sent.filterAll") },
    { key: "pending", label: t("sent.filterPending") },
    { key: "finished", label: t("sent.filterFinished") },
    { key: "stopped", label: t("sent.filterStopped") },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t("sent.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sent.subtitle")}</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition sm:flex-none",
                filter === f.key
                  ? "bg-action text-action-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center">
            <SendIcon className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t("sent.empty")}</p>
          </div>
        ) : (
          <>
            {/* Vue tableau (>= md) */}
            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">{t("sent.cols.binder")}</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {t("sent.cols.recipients")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">{t("sent.cols.progress")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("sent.cols.updated")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("sent.cols.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <BinderRow
                      key={b.id}
                      binder={b}
                      fmt={fmt}
                      onRemind={onRemind}
                      remindedKey={remindedKey}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vue cartes (mobile) */}
            <div className="space-y-3 md:hidden">
              {items.map((b) => (
                <BinderCard
                  key={b.id}
                  binder={b}
                  fmt={fmt}
                  onRemind={onRemind}
                  remindedKey={remindedKey}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-action transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-foreground">{pct}%</span>
    </div>
  );
}

function SignerStatusIcon({
  status,
}: {
  status: "pending" | "signed" | "declined" | undefined;
}) {
  if (status === "signed")
    return <CheckCircle2 className="h-3.5 w-3.5 text-action" aria-label="signed" />;
  if (status === "declined")
    return <XCircle className="h-3.5 w-3.5 text-destructive" aria-label="declined" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-label="pending" />;
}

function BinderRow({
  binder,
  fmt,
  onRemind,
  remindedKey,
}: {
  binder: Binder;
  fmt: (iso: string) => string;
  onRemind: (binderId: string, signerId: string) => void;
  remindedKey: string | null;
}) {
  const { t } = useTranslation();
  const signers = binder.signers ?? [];
  const total = signers.length;
  const done = signers.filter((s) => s.status === "signed").length;
  const pendingSigners = signers.filter((s) => s.status !== "signed" && s.status !== "declined");
  const canRemind = binder.status === "started" && pendingSigners.length > 0;

  return (
    <tr className="border-b last:border-0 align-top hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          to="/binders/detail/$id"
          params={{ id: binder.id }}
          className="font-medium text-foreground hover:underline"
        >
          {binder.name}
        </Link>
        {binder.description && (
          <div className="mt-0.5 text-xs text-muted-foreground">{binder.description}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <ul className="space-y-1">
          {signers.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-xs">
              <SignerStatusIcon status={s.status} />
              <span className="text-foreground">{s.name}</span>
              <span className="text-muted-foreground">— {s.email}</span>
            </li>
          ))}
          {signers.length === 0 && (
            <li className="text-xs text-muted-foreground">{t("newBinder.noSigners")}</li>
          )}
        </ul>
      </td>
      <td className="px-4 py-3">
        <ProgressBar done={done} total={total} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          {t("sent.signedCount", { done, total })}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(binder.updatedAt)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={binder.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1.5">
          <Link
            to="/binders/detail/$id"
            params={{ id: binder.id }}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("sent.view")}
          </Link>
          {canRemind &&
            pendingSigners.map((s) => {
              const k = `${binder.id}:${s.id}`;
              const just = remindedKey === k;
              return (
                <button
                  key={s.id}
                  onClick={() => onRemind(binder.id, s.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                    just
                      ? "border-action/40 bg-action/10 text-action"
                      : "bg-background hover:bg-accent",
                  )}
                  title={s.email}
                >
                  <BellRing className="h-3 w-3" />
                  {just ? t("sent.reminded") : `${t("sent.remind")} ${s.name.split(" ")[0]}`}
                </button>
              );
            })}
        </div>
      </td>
    </tr>
  );
}

function BinderCard({
  binder,
  fmt,
  onRemind,
  remindedKey,
}: {
  binder: Binder;
  fmt: (iso: string) => string;
  onRemind: (binderId: string, signerId: string) => void;
  remindedKey: string | null;
}) {
  const { t } = useTranslation();
  const signers = binder.signers ?? [];
  const total = signers.length;
  const done = signers.filter((s) => s.status === "signed").length;
  const pendingSigners = signers.filter((s) => s.status !== "signed" && s.status !== "declined");
  const canRemind = binder.status === "started" && pendingSigners.length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/binders/detail/$id"
          params={{ id: binder.id }}
          className="font-medium text-foreground hover:underline"
        >
          {binder.name}
        </Link>
        <StatusBadge status={binder.status} />
      </div>
      {binder.description && (
        <p className="mt-1 text-xs text-muted-foreground">{binder.description}</p>
      )}
      <div className="mt-3">
        <ProgressBar done={done} total={total} />
        <div className="mt-1 text-[11px] text-muted-foreground">
          {t("sent.signedCount", { done, total })} · {fmt(binder.updatedAt)}
        </div>
      </div>
      {signers.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-2">
          {signers.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-xs">
              <SignerStatusIcon status={s.status} />
              <span className="text-foreground">{s.name}</span>
              <span className="text-muted-foreground">— {s.email}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button asChild size="sm" variant="outline">
          <Link to="/binders/detail/$id" params={{ id: binder.id }}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            {t("sent.view")}
          </Link>
        </Button>
        {canRemind &&
          pendingSigners.map((s) => {
            const k = `${binder.id}:${s.id}`;
            const just = remindedKey === k;
            return (
              <button
                key={s.id}
                onClick={() => onRemind(binder.id, s.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                  just
                    ? "border-action/40 bg-action/10 text-action"
                    : "bg-background hover:bg-accent",
                )}
              >
                <BellRing className="h-3 w-3" />
                {just ? t("sent.reminded") : `${t("sent.remind")} ${s.name.split(" ")[0]}`}
              </button>
            );
          })}
      </div>
    </div>
  );
}
