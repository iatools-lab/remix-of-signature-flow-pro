import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FilePlus2,
  X,
  Plus,
  Trash2,
  FileText,
  Check,
  Paperclip,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import {
  type BinderDocument,
  type BinderAttachment,
  type BinderSigner,
  type BinderNotifications,
  type SignatureField,
  SIGNER_COLORS,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { DocumentPagePreview } from "./DocumentPagePreview";

type StepKey =
  | "general"
  | "documents"
  | "attachments"
  | "signers"
  | "placement"
  | "notifications"
  | "review";

const STEPS: StepKey[] = [
  "general",
  "documents",
  "attachments",
  "signers",
  "placement",
  "notifications",
  "review",
];

// Width / height of a signature zone, in fractions of the page.
const ZONE_W = 0.22;
const ZONE_H = 0.06;

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
  const [attachments, setAttachments] = useState<BinderAttachment[]>([]);
  const [signers, setSigners] = useState<BinderSigner[]>([]);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [notif, setNotif] = useState<BinderNotifications>({
    onStart: true,
    onComplete: true,
    reminders: false,
  });

  // Placement step state
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);

  const stepIndex = STEPS.indexOf(step);

  const reset = () => {
    setStep("general");
    setName("");
    setDescription("");
    setGroup("");
    setConsolidation(false);
    setDocuments([]);
    setAttachments([]);
    setSigners([]);
    setFields([]);
    setNotif({ onStart: true, onComplete: true, reminders: false });
    setActiveSignerId(null);
    setActiveDocId(null);
    setActivePage(1);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const canNext = useMemo(() => {
    if (step === "general") return name.trim().length > 0;
    if (step === "signers")
      return signers.length > 0 && signers.every((s) => s.name.trim() && s.email.trim());
    if (step === "placement") return true; // optional
    return true;
  }, [step, name, signers]);

  const goNext = () => {
    if (!canNext) return;
    if (step === "review") return submit();
    const nextStep = STEPS[stepIndex + 1];
    setStep(nextStep);
    // Initialize placement defaults when entering the step
    if (nextStep === "placement") {
      if (!activeSignerId && signers[0]) setActiveSignerId(signers[0].id);
      if (!activeDocId && documents[0]) {
        setActiveDocId(documents[0].id);
        setActivePage(1);
      }
    }
  };
  const goBack = () => stepIndex > 0 && setStep(STEPS[stepIndex - 1]);

  const submit = () => {
    const session = getSession();
    const enrichedSigners: BinderSigner[] = signers.map((s, i) => ({
      ...s,
      order: i + 1,
      color: s.color ?? SIGNER_COLORS[i % SIGNER_COLORS.length],
      status: "pending",
    }));
    const b = create({
      name: name.trim(),
      description: description.trim() || undefined,
      group,
      ownerName: session?.name ?? "User",
      ownerEmail: session?.email ?? "user@example.com",
      ownerInitials: session?.initials ?? "US",
      documents,
      attachments,
      signers: enrichedSigners,
      signatureFields: fields,
      notifications: notif,
      consolidation,
    });
    handleClose(false);
    onCreated?.(b.id);
  };

  const onPickDocs = (files: FileList | null) => {
    if (!files) return;
    const next: BinderDocument[] = Array.from(files).map((f, i) => ({
      id: `d_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
      pages: 1 + ((f.size ?? 1000) % 3), // mock 1-3 pages
    }));
    setDocuments((prev) => [...prev, ...next]);
  };

  const onPickAttachments = (files: FileList | null) => {
    if (!files) return;
    const next: BinderAttachment[] = Array.from(files).map((f, i) => ({
      id: `a_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const addSigner = () =>
    setSigners((p) => {
      const order = p.length + 1;
      const color = SIGNER_COLORS[p.length % SIGNER_COLORS.length];
      return [
        ...p,
        { id: `s_${Date.now()}`, order, name: "", email: "", color, status: "pending" },
      ];
    });

  const removeSigner = (id: string) => {
    setSigners((p) => p.filter((x) => x.id !== id));
    setFields((p) => p.filter((f) => f.signerId !== id));
    if (activeSignerId === id) setActiveSignerId(null);
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const activeSigner = signers.find((s) => s.id === activeSignerId);

  const placePage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSignerId || !activeDocId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    const yRel = (e.clientY - rect.top) / rect.height;
    setFields((p) => [
      ...p,
      {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        documentId: activeDocId,
        page: activePage,
        x: Math.max(0, Math.min(1 - ZONE_W, xRel - ZONE_W / 2)),
        y: Math.max(0, Math.min(1 - ZONE_H, yRel - ZONE_H / 2)),
        width: ZONE_W,
        height: ZONE_H,
        signerId: activeSignerId,
      },
    ]);
  };

  const removeField = (id: string) => setFields((p) => p.filter((f) => f.id !== id));

  const fieldsOnPage = fields.filter(
    (f) => f.documentId === activeDocId && f.page === activePage,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
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
                    "hidden text-[11px] font-medium lg:inline",
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
        <div className="max-h-[60vh] overflow-y-auto px-8 py-6">
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
              <p className="text-sm text-muted-foreground">{t("newBinder.documentsHelp")}</p>
              <UploadBox
                label={t("newBinder.addDocument")}
                accept=".pdf,.docx,.doc,.txt"
                onPick={onPickDocs}
                icon={FileText}
              />
              {documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.noDocuments")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <FileRow
                      key={d.id}
                      icon={FileText}
                      name={d.name}
                      size={d.size}
                      onRemove={() => {
                        setDocuments((p) => p.filter((x) => x.id !== d.id));
                        setFields((p) => p.filter((f) => f.documentId !== d.id));
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "attachments" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("newBinder.attachmentsHelp")}</p>
              <UploadBox
                label={t("newBinder.addAttachment")}
                accept="*"
                onPick={onPickAttachments}
                icon={Paperclip}
              />
              {attachments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.noAttachments")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((a) => (
                    <FileRow
                      key={a.id}
                      icon={Paperclip}
                      name={a.name}
                      size={a.size}
                      onRemove={() =>
                        setAttachments((p) => p.filter((x) => x.id !== a.id))
                      }
                    />
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
              {signers.map((s, idx) => {
                const color = s.color ?? SIGNER_COLORS[idx % SIGNER_COLORS.length];
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[40px_1fr_1fr_36px] items-center gap-2 rounded-md border bg-card p-2"
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {idx + 1}
                    </div>
                    <Input
                      placeholder={t("newBinder.signerName")}
                      value={s.name}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      type="email"
                      placeholder={t("newBinder.signerEmail")}
                      value={s.email}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, email: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      onClick={() => removeSigner(s.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addSigner}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-action/40 bg-action/5 py-3 text-sm font-medium text-action hover:bg-action/10"
              >
                <Plus className="h-4 w-4" /> {t("newBinder.addSigner")}
              </button>
            </div>
          )}

          {step === "placement" && (
            <div className="space-y-4">
              {documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.placementNoDocs")}
                </p>
              ) : signers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.placementNoSigners")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("newBinder.placementHelp")}
                  </p>

                  {/* Signer chips */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("newBinder.selectSigner")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {signers.map((s) => {
                        const active = s.id === activeSignerId;
                        const color = s.color ?? "#0EA5E9";
                        const count = fields.filter((f) => f.signerId === s.id).length;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setActiveSignerId(s.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "bg-card text-foreground hover:bg-accent",
                            )}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            {s.name || `#${s.order}`}
                            <span className="rounded-full bg-background/20 px-1.5 text-[10px]">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Doc tabs */}
                  <div className="flex flex-wrap gap-2 border-b pb-2">
                    {documents.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setActiveDocId(d.id);
                          setActivePage(1);
                        }}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          activeDocId === d.id
                            ? "bg-action/15 text-action"
                            : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>

                  {/* Page nav */}
                  {activeDoc && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <button
                        onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                        disabled={activePage <= 1}
                        className="flex items-center gap-1 rounded p-1 disabled:opacity-40 hover:bg-accent"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span>
                        {t("newBinder.page")} {activePage} / {activeDoc.pages ?? 1}
                      </span>
                      <button
                        onClick={() =>
                          setActivePage((p) => Math.min(activeDoc.pages ?? 1, p + 1))
                        }
                        disabled={activePage >= (activeDoc.pages ?? 1)}
                        className="flex items-center gap-1 rounded p-1 disabled:opacity-40 hover:bg-accent"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Page preview */}
                  {activeDoc && (
                    <div className="mx-auto max-w-md">
                      <DocumentPagePreview
                        documentName={activeDoc.name}
                        page={activePage}
                        totalPages={activeDoc.pages ?? 1}
                        onClick={activeSigner ? placePage : undefined}
                      >
                        {fieldsOnPage.map((f) => {
                          const signer = signers.find((s) => s.id === f.signerId);
                          const color = signer?.color ?? "#0EA5E9";
                          return (
                            <div
                              key={f.id}
                              className="absolute flex items-center justify-between rounded border-2 px-1.5 text-[9px] font-semibold uppercase shadow-sm"
                              style={{
                                left: `${f.x * 100}%`,
                                top: `${f.y * 100}%`,
                                width: `${f.width * 100}%`,
                                height: `${f.height * 100}%`,
                                borderColor: color,
                                backgroundColor: `${color}25`,
                                color,
                              }}
                            >
                              <span className="truncate">
                                {signer?.name?.split(" ")[0] || `#${signer?.order}`}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeField(f.id);
                                }}
                                className="rounded p-0.5 hover:bg-white/40"
                                aria-label={t("newBinder.removeZone")}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </DocumentPagePreview>
                    </div>
                  )}
                </>
              )}
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
                label={t("newBinder.steps.attachments")}
                value={
                  attachments.length === 0
                    ? t("newBinder.noAttachments")
                    : attachments.map((a) => a.name).join(", ")
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
                label={t("newBinder.steps.placement")}
                value={`${fields.length} zone(s)`}
              />
              <ReviewRow
                label={t("newBinder.steps.notifications")}
                value={
                  [
                    notif.onStart && t("newBinder.notifyOnStart"),
                    notif.onComplete && t("newBinder.notifyOnComplete"),
                    notif.reminders && t("newBinder.notifyOnReminder"),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
            {t("common.cancel")}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0}>
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

function UploadBox({
  label,
  accept,
  onPick,
  icon: Icon,
}: {
  label: string;
  accept: string;
  onPick: (files: FileList | null) => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-action/40 bg-action/5 p-8 text-center transition hover:bg-action/10">
      <Icon className="h-6 w-6 text-action" />
      <span className="text-sm font-medium text-action">{label}</span>
      <span className="text-xs text-muted-foreground">PDF, DOCX, ZIP…</span>
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </label>
  );
}

function FileRow({
  icon: Icon,
  name,
  size,
  onRemove,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  size?: number;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-action" />
        <span className="text-foreground">{name}</span>
        {size && (
          <span className="text-xs text-muted-foreground">
            {(size / 1024).toFixed(1)} KB
          </span>
        )}
      </div>
      <button
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
