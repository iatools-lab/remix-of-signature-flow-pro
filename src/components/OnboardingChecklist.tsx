import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, PenLine, UserPlus, FilePlus2, UserCog, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getMySignature } from "@/lib/mySignature";
import { useBinders, useContacts } from "@/lib/store";
import {
  dismissOnboarding,
  isOnboardingDismissed,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type StepKey = "signature" | "contact" | "binder" | "profile";

type Step = {
  key: StepKey;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onAction: () => void;
};

export function OnboardingChecklist({
  onCreateBinder,
  onCreateContact,
}: {
  onCreateBinder: () => void;
  onCreateContact: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { binders } = useBinders();
  const { contacts } = useContacts();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profileDone, setProfileDone] = useState(false);

  const refresh = () => {
    const s = getSession();
    const e = s?.email ?? null;
    setEmail(e);
    setDismissed(isOnboardingDismissed(e));
    setHasSig(Boolean(getMySignature(e)));
    setProfileDone(Boolean(s?.phone || s?.photo));
  };

  useEffect(() => {
    setMounted(true);
    refresh();
    const sync = () => refresh();
    window.addEventListener("goodflag:auth", sync);
    window.addEventListener("usign:mySignature", sync);
    window.addEventListener("usign:onboarding", sync);
    return () => {
      window.removeEventListener("goodflag:auth", sync);
      window.removeEventListener("usign:mySignature", sync);
      window.removeEventListener("usign:onboarding", sync);
    };
  }, []);

  const ownEmail = (email ?? "").toLowerCase();
  const ownsBinder = useMemo(
    () => binders.some((b) => b.ownerEmail.toLowerCase() === ownEmail),
    [binders, ownEmail],
  );
  const hasContact = contacts.length > 0;

  const steps: Step[] = [
    {
      key: "signature",
      done: hasSig,
      icon: PenLine,
      onAction: () => navigate({ to: "/my-signature" }),
    },
    {
      key: "contact",
      done: hasContact,
      icon: UserPlus,
      onAction: onCreateContact,
    },
    {
      key: "binder",
      done: ownsBinder,
      icon: FilePlus2,
      onAction: onCreateBinder,
    },
    {
      key: "profile",
      done: profileDone,
      icon: UserCog,
      onAction: () => navigate({ to: "/settings" }),
    },
  ];

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === total;

  if (!mounted || !email || dismissed) return null;
  if (allDone) return null; // Auto-hide once everything is done.

  return (
    <section
      aria-label="Onboarding"
      className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-action/10 via-card to-card p-5 shadow-sm sm:p-6"
    >
      <button
        type="button"
        onClick={() => {
          dismissOnboarding(email);
          setDismissed(true);
        }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={t("onboarding.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action/15 text-action">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {t("onboarding.title")}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("onboarding.subtitle")}
            </p>
          </div>
        </div>

        <div className="min-w-[140px] sm:min-w-[180px]">
          <div className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("onboarding.progress", { done: doneCount, total })}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-action transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "group flex items-start gap-3 rounded-lg border bg-background/60 p-3 transition",
              s.done ? "opacity-70" : "hover:border-action/40 hover:bg-background",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                s.done ? "bg-action text-action-foreground" : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {s.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {i + 1}
                </span>
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3
                  className={cn(
                    "truncate text-sm font-semibold",
                    s.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {t(`onboarding.steps.${s.key}.title`)}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`onboarding.steps.${s.key}.description`)}
              </p>
              {!s.done && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={s.onAction}
                  className="mt-2 h-7 px-2.5 text-xs"
                >
                  {t(`onboarding.steps.${s.key}.cta`)}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
