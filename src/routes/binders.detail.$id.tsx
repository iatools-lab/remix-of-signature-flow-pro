import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X, MessageSquare, ChevronLeft, ChevronRight, Pencil, Plus, Download, HelpCircle, Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useBinders } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/binders/detail/$id")({
  head: () => ({ meta: [{ title: "Détail parapheur — Goodflag" }] }),
  component: BinderDetail,
});

type Tab = "general" | "steps" | "documents" | "notifications" | "operations";

function BinderDetail() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { binders } = useBinders();
  const navigate = useNavigate();
  const binder = binders.find((b) => b.id === id);
  const [tab, setTab] = useState<Tab>("general");

  if (!binder) {
    return (
      <AppShell>
        <div className="text-center text-muted-foreground">
          Parapheur introuvable.{" "}
          <Link to="/binders/$status" params={{ status: "draft" }} className="text-action underline">
            Retour
          </Link>
        </div>
      </AppShell>
    );
  }

  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString(i18n.language === "fr" ? "fr-FR" : "en-US", {
          day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
        })
      : "—";

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: t("detail.tabs.general") },
    { key: "steps", label: t("detail.tabs.steps") },
    { key: "documents", label: t("detail.tabs.documents") },
    { key: "notifications", label: t("detail.tabs.notifications") },
    { key: "operations", label: t("detail.tabs.operations") },
  ];

  return (
    <AppShell>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-sidebar px-6 pt-5 text-sidebar-foreground">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{t("detail.title")}</h2>
              <div className="mt-3 flex gap-5 text-sm">
                {TABS.map((tb) => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`pb-2 transition ${
                      tab === tb.key
                        ? "border-b-2 border-sidebar-primary font-medium text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="rounded p-2 hover:bg-sidebar-accent" aria-label="Comments">
                <MessageSquare className="h-5 w-5" />
              </button>
              <button className="rounded p-2 hover:bg-sidebar-accent" aria-label="Previous">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button className="rounded p-2 hover:bg-sidebar-accent" aria-label="Next">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate({ to: "/binders/$status", params: { status: binder.status } })}
                className="rounded p-2 hover:bg-sidebar-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="h-1" />
        </div>

        <div className="space-y-10 px-8 py-8">
          {tab === "general" && (
            <Section title={t("detail.tabs.general")}>
              <Row label={t("newBinder.name")}>
                <span className="text-sm text-foreground">{binder.name}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Row>
              <Row label={t("newBinder.description")}>
                <span className="text-sm text-foreground">{binder.description ?? "—"}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Row>
              <Row label={t("detail.owner")}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {binder.ownerInitials}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-foreground">{binder.ownerName}</div>
                  <div className="text-xs text-muted-foreground">{binder.ownerEmail}</div>
                </div>
                <Pencil className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
              </Row>
              <Row label={t("detail.group")}>
                <Users className="h-4 w-4 text-foreground" />
                <span className="text-sm text-foreground">{binder.group}</span>
              </Row>
              <Row label={t("detail.createdAt")}>
                <span className="text-sm text-foreground">{fmt(binder.createdAt)}</span>
              </Row>
              <Row label={t("detail.startedAt")}>
                <span className="text-sm text-foreground">{fmt(binder.startedAt)}</span>
              </Row>
              <Row label={t("detail.updatedAt")}>
                <span className="text-sm text-foreground">{fmt(binder.updatedAt)}</span>
              </Row>
              <Row label={t("detail.status")}>
                <StatusBadge status={binder.status} />
              </Row>
              <Row label={t("detail.progress")}>
                <div className="rounded border bg-background px-3 py-1 text-xs font-medium text-foreground">
                  {binder.progress} %
                </div>
              </Row>
              <Row
                label={
                  <span className="inline-flex items-center gap-1">
                    {t("detail.consolidation")}
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                }
              >
                <span className="text-sm text-foreground">
                  {binder.consolidation ? t("common.yes") : t("common.no")}
                </span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Row>
            </Section>
          )}

          {(tab === "steps" || tab === "general") && (
            <Section title={t("detail.tabs.steps")}>
              <button className="mx-auto flex items-center gap-3 py-6 text-action">
                <Plus className="h-4 w-4" />
                <span className="font-medium">{t("detail.addStep")}</span>
              </button>
            </Section>
          )}

          {(tab === "documents" || tab === "general") && (
            <Section title={t("detail.tabs.documents")}>
              <div className="flex flex-wrap justify-center gap-5 py-4">
                <DropZone label={t("detail.addDocs")}>
                  <label className="flex items-start gap-2 text-xs text-foreground">
                    <Checkbox defaultChecked /> {t("detail.convertPdf")}
                  </label>
                  <label className="flex items-start gap-2 text-xs text-foreground">
                    <Checkbox defaultChecked /> {t("detail.unzip")}
                  </label>
                </DropZone>
                <DropZone label={t("detail.addAttachments")} />
              </div>
            </Section>
          )}

          {(tab === "notifications" || tab === "general") && (
            <Section title={t("detail.tabs.notifications")}>
              <div className="flex items-center gap-3 py-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {binder.ownerInitials}
                </span>
                <div className="flex-1 leading-tight">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {binder.ownerName}
                    <span className="rounded-full bg-action/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-action">
                      {t("detail.owner_badge")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{binder.ownerEmail}</div>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </div>
              <button className="mx-auto flex items-center gap-2 py-3 text-sm font-medium text-action">
                <Plus className="h-4 w-4" /> {t("detail.addCc")}
              </button>
            </Section>
          )}

          {(tab === "operations" || tab === "general") && (
            <Section title={t("detail.tabs.operations")}>
              <div className="flex flex-wrap gap-3 py-2">
                <OpButton icon={Download} label="Télécharger" />
                <OpButton icon={Pencil} label="Renommer" />
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b pb-2 text-xl font-semibold text-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <div className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function DropZone({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex w-60 flex-col items-center gap-3 rounded-lg border-2 border-dashed border-action/40 bg-action/5 p-5 text-center">
      <Download className="h-5 w-5 text-action" />
      <div className="text-sm font-medium text-action">{label}</div>
      {children && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function OpButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
