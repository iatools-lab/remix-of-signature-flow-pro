import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useContacts } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { NewContactDialog } from "@/components/NewContactDialog";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Goodflag" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const { t } = useTranslation();
  const { contacts, remove } = useContacts();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.email} ${c.company ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [contacts, query],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("contacts.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-action-foreground shadow-sm transition hover:opacity-90"
            aria-label="New contact"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("contacts.cols.name")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("contacts.cols.email")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("contacts.cols.phone")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("contacts.cols.company")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {t("contacts.empty")}
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                        {(c.firstName[0] + c.lastName[0]).toUpperCase()}
                      </span>
                      <span className="font-medium text-foreground">
                        {c.firstName} {c.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <NewContactDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
