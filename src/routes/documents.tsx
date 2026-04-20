import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, ListFilter, ArrowDownUp, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useBinders } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — Goodflag" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { t, i18n } = useTranslation();
  const { binders } = useBinders();
  const [query, setQuery] = useState("");

  // Aggregate every real document attached to a binder (any status).
  const docs = useMemo(
    () =>
      binders
        .flatMap((b) =>
          (b.documents ?? []).map((d) => ({
            id: d.id,
            name: d.name,
            binder: b.name,
            updatedAt: b.updatedAt,
          })),
        )
        .filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
    [binders, query],
  );

  const fmt = (iso: string) => formatDateTime(iso, i18n.language);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("documents.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><ListFilter className="h-4 w-4" /> {t("common.filter")}</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><ArrowDownUp className="h-4 w-4" /> {t("common.sort")}</Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("documents.cols.name")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("documents.cols.binder")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("documents.cols.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                    {t("documents.empty")}
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <FileText className="h-4 w-4 text-action" />
                      {d.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.binder}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
