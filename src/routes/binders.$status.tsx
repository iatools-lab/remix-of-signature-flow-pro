import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Trash2, ExternalLink, ListFilter, ArrowDownUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { NewBinderDialog } from "@/components/NewBinderDialog";
import { useBinders } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BinderStatus } from "@/lib/mockData";

const VALID: BinderStatus[] = ["draft", "started", "finished", "stopped", "archived"];

export const Route = createFileRoute("/binders/$status")({
  parseParams: (params) => ({
    status: (VALID.includes(params.status as BinderStatus) ? params.status : "draft") as BinderStatus,
  }),
  head: () => ({
    meta: [{ title: "Parapheurs — Goodflag" }],
  }),
  component: BindersByStatus,
});

function BindersByStatus() {
  const { status } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { binders, remove } = useBinders();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      binders
        .filter((b) => b.status === status)
        .filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
    [binders, status, query],
  );

  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language === "fr" ? "fr-FR" : "en-US", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("binders.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ListFilter className="h-4 w-4" /> {t("common.filter")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowDownUp className="h-4 w-4" /> {t("common.sort")}
            </Button>
            <button
              onClick={() => setOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-action-foreground shadow-sm transition hover:opacity-90"
              aria-label="New binder"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {VALID.map((s) => (
            <Link
              key={s}
              to="/binders/$status"
              params={{ status: s }}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                s === status ? "border-transparent bg-foreground text-background" : "bg-card text-foreground hover:bg-accent"
              }`}
            >
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: `var(--status-${s})` }} />
              {t(`status.${s}`)}
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.name")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.owner")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.updated")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.status")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.archive")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("binders.cols.progress")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t("binders.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/binders/detail/$id" params={{ id: b.id }} className="font-medium text-foreground hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                        {b.ownerInitials}
                      </span>
                      <div className="leading-tight">
                        <div className="text-xs font-medium text-foreground">{b.ownerName}</div>
                        <div className="text-[11px] text-muted-foreground">{b.ownerEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(b.updatedAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{b.externalArchive ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-action" style={{ width: `${b.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{b.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate({ to: "/binders/detail/$id", params: { id: b.id } })}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Open"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(b.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <NewBinderDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(id) => navigate({ to: "/binders/detail/$id", params: { id } })}
      />
    </AppShell>
  );
}
