import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilePlus2, X, Plus, Trash2, FileText, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useBinders } from "@/lib/store";
import { getSession } from "@/lib/auth";
import type { BinderDocument, BinderSigner, BinderNotifications } from "@/lib/mockData";
import { cn } from "@/lib/utils";

type StepKey = "general" | "documents" | "signers" | "notifications" | "review";
const STEPS: StepKey[] = ["general", "documents", "signers", "notifications", "review"];

export function NewBinderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { create } = useBinders();

  const [step, setStep] = useState<StepKey>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [consolidation, setConsolidation] = useState(false);
  const [documents, setDocuments] = useState<BinderDocument[]>([]);
  const [signers, setSigners] = useState<BinderSigner[]>([]);
  const [notif, setNotif] = useState<BinderNotifications>({
    onStart: true,
    onComplete: true,
    reminders: false,
  });

  const stepIndex = STEPS.indexOf(step);

  const reset = () => {
    setStep("general");
    setName("");
    setDescription("");
    setGroup("");
    setConsolidation(false);
    setDocuments([]);
    setSigners([]);
    setNotif({ onStart: true, onComplete: true, reminders: false });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const canNext = useMemo(() => {
    if (step === "general") return name.trim().length > 0;
    if (step === "signers") return signers.every((s) => s.name.trim() && s.email.trim());
    return true;
  }, [step, name, signers]);

  const goNext = () => {
    if (!canNext) return;
    if (step === "review") return submit();
    setStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => stepIndex > 0 && setStep(STEPS[stepIndex - 1]);

  const submit = () => {
    const session = getSession();
    const b = create({
      name: name.trim(),
      description: description.trim() || undefined,
      group,
      ownerName: session?.name ?? "User",
      ownerEmail: session?.email ?? "user@example.com",
      ownerInitials: session?.initials ?? "US",
      documents,
      signers,
      notifications: notif,
      consolidation,
    });
    handleClose(false);
    onCreated?.(b.id);
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const next: BinderDocument[] = Array.from(files).map((f, i) => ({
      id: `d_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
    }));
    setDocuments((prev) => [...prev, ...next]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between space-y-0 bg-sidebar px-6 py-4 text-sidebar-foreground [&>button]:hidden">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <FilePlus2 className="h-5 w-5" />
            {t("newBinder.title")}
          </DialogTitle>
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="rounded p-1 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-6 py-4">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition",
                    done && "border-action bg-action text-action-foreground",
                    active && "border-action bg-background text-action",
                    !done && !active && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:inline",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`newBinder.steps.${s}`)}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1", done ? "bg-action" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-8 py-6">
          {step === "general" && (
            <div className="space-y-5">
              <Field label={`${t("newBinder.name")} *`}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                  className="border-action/40 focus-visible:ring-action"
                />
              </Field>
              <Field label={t("newBinder.description")}>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </Field>
              <Field label={t("newBinder.group")}>
                <Input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="Utilisateurs Principaux"
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-foreground">
                <Checkbox
                  checked={consolidation}
                  onCheckedChange={(v) => setConsolidation(Boolean(v))}
                />
                {t("newBinder.consolidationLabel")}
              </label>
            </div>
          )}

          {step === "documents" && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-action/40 bg-action/5 p-8 text-center transition hover:bg-action/10">
                <Plus className="h-6 w-6 text-action" />
                <span className="text-sm font-medium text-action">
                  {t("newBinder.addDocument")}
                </span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, ZIP…</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </label>
              {documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.noDocuments")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-action" />
                        <span className="text-foreground">{d.name}</span>
                        {d.size && (
                          <span className="text-xs text-muted-foreground">
                            {(d.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setDocuments((p) => p.filter((x) => x.id !== d.id))}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "signers" && (
            <div className="space-y-3">
              {signers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.noSigners")}
                </p>
              )}
              {signers.map((s, idx) => (
                <div
                  key={s.id}
                  className="grid grid-cols-[40px_1fr_1fr_36px] items-center gap-2 rounded-md border bg-card p-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                    {idx + 1}
                  </div>
                  <Input
                    placeholder={t("newBinder.signerName")}
                    value={s.name}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    type="email"
                    placeholder={t("newBinder.signerEmail")}
                    value={s.email}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, email: e.target.value } : x)),
                      )
                    }
                  />
                  <button
                    onClick={() => setSigners((p) => p.filter((x) => x.id !== s.id))}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setSigners((p) => [
                    ...p,
                    { id: `s_${Date.now()}`, order: p.length + 1, name: "", email: "" },
                  ])
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-action/40 bg-action/5 py-3 text-sm font-medium text-action hover:bg-action/10"
              >
                <Plus className="h-4 w-4" /> {t("newBinder.addSigner")}
              </button>
            </div>
          )}

          {step === "notifications" && (
            <div className="space-y-3">
              <NotifRow
                label={t("newBinder.notifyOnStart")}
                checked={notif.onStart}
                onChange={(v) => setNotif((n) => ({ ...n, onStart: v }))}
              />
              <NotifRow
                label={t("newBinder.notifyOnComplete")}
                checked={notif.onComplete}
                onChange={(v) => setNotif((n) => ({ ...n, onComplete: v }))}
              />
              <NotifRow
                label={t("newBinder.notifyOnReminder")}
                checked={notif.reminders}
                onChange={(v) => setNotif((n) => ({ ...n, reminders: v }))}
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{t("newBinder.reviewIntro")}</p>
              <ReviewRow label={t("newBinder.name")} value={name || "—"} />
              <ReviewRow label={t("newBinder.description")} value={description || "—"} />
              <ReviewRow label={t("newBinder.group")} value={group || "Utilisateurs Principaux"} />
              <ReviewRow
                label={t("newBinder.steps.documents")}
                value={
                  documents.length === 0
                    ? t("newBinder.noDocuments")
                    : documents.map((d) => d.name).join(", ")
                }
              />
              <ReviewRow
                label={t("newBinder.steps.signers")}
                value={
                  signers.length === 0
                    ? t("newBinder.noSigners")
                    : signers.map((s, i) => `${i + 1}. ${s.name} <${s.email}>`).join(" · ")
                }
              />
              <ReviewRow
                label={t("newBinder.steps.notifications")}
                value={[
                  notif.onStart && t("newBinder.notifyOnStart"),
                  notif.onComplete && t("newBinder.notifyOnComplete"),
                  notif.reminders && t("newBinder.notifyOnReminder"),
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleClose(false)}
          >
            {t("common.cancel")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              {t("newBinder.back")}
            </Button>
            <Button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="bg-action text-action-foreground hover:opacity-90"
            >
              {step === "review" ? t("newBinder.create") : t("newBinder.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4">
      <label className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function NotifRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border bg-card px-4 py-3 text-sm text-foreground hover:bg-accent">
      <span>{label}</span>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 border-b pb-2 last:border-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}
