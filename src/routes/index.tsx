import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FilePlus2, UserPlus, Settings } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NewBinderDialog } from "@/components/NewBinderDialog";
import { NewContactDialog } from "@/components/NewContactDialog";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { useBinders } from "@/lib/store";
import type { BinderStatus } from "@/lib/mockData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — Usign" },
      { name: "description", content: "Tableau de bord de signature électronique Usign." },
    ],
  }),
  component: HomePage,
});

const STATUSES: BinderStatus[] = ["draft", "started", "finished", "stopped", "archived"];

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { binders } = useBinders();
  const [newBinderOpen, setNewBinderOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);

  const counts = STATUSES.reduce<Record<BinderStatus, number>>(
    (acc, s) => {
      acc[s] = binders.filter((b) => b.status === s).length;
      return acc;
    },
    { draft: 0, started: 0, finished: 0, stopped: 0, archived: 0 },
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <OnboardingChecklist
          onCreateBinder={() => setNewBinderOpen(true)}
          onCreateContact={() => setNewContactOpen(true)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setNewBinderOpen(true)}
              className="flex items-center gap-2 rounded-md bg-action px-3.5 py-2 text-sm font-medium text-action-foreground shadow-sm transition hover:opacity-90"
            >
              <FilePlus2 className="h-4 w-4" />
              {t("home.newBinder")}
            </button>
            <button
              onClick={() => setNewContactOpen(true)}
              className="flex items-center gap-2 rounded-md bg-action px-3.5 py-2 text-sm font-medium text-action-foreground shadow-sm transition hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" />
              {t("home.newContact")}
            </button>
          </div>
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <section>
          <h2 className="mb-5 border-b pb-2 text-2xl font-semibold text-foreground">
            {t("home.binders")}
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {STATUSES.map((s) => (
              <Link
                key={s}
                to="/binders/$status"
                params={{ status: s }}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: `var(--status-${s})` }}
                >
                  {t(`status.${s}`)}
                </div>
                <div className="relative flex h-32 items-center justify-center bg-muted/40">
                  <span className="text-5xl font-light text-foreground/80">{counts[s]}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <NewBinderDialog open={newBinderOpen} onOpenChange={setNewBinderOpen} />
      <NewContactDialog open={newContactOpen} onOpenChange={setNewContactOpen} />
    </AppShell>
  );
}
