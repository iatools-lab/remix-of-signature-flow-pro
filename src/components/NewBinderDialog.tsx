import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
// Autocomplete implemented inline; no Select component used here
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiBaseUrl, getErrorMessage, getStoredAuthToken } from "@/lib/api";
import { isAllowedSignerEmail } from "@/lib/email";
import { useBinders, useContacts } from "@/lib/store";
import { getSession } from "@/lib/auth";
import {
  type BinderDocument,
  type BinderAttachment,
  type Binder,
  type BinderSigner,
  type BinderNotifications,
  type SignatureField,
  type SignatureFieldKind,
  SIGNER_COLORS,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { DocumentPagePreview } from "./DocumentPagePreview";

type LocalBinderDocument = BinderDocument & {
  file?: File;
  mimeType?: string;
};

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
// Smaller default for an "initial" (paraphe) zone.
const INITIAL_W = 0.09;
const INITIAL_H = 0.05;

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function NewBinderDialog({
  open,
  onOpenChange,
  onCreated,
  draftBinder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  draftBinder?: Binder | null;
}) {
  const { t } = useTranslation();
  const { create, update, startBinder } = useBinders();
  const { contacts, create: createContact } = useContacts();
  const [focusedSignerId, setFocusedSignerId] = useState<string | null>(null);
  const isEditingDraft = Boolean(draftBinder);

  const [step, setStep] = useState<StepKey>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [consolidation, setConsolidation] = useState(false);
  const [documents, setDocuments] = useState<LocalBinderDocument[]>([]);
  const [attachments, setAttachments] = useState<BinderAttachment[]>([]);
  const [signers, setSigners] = useState<BinderSigner[]>([]);
  const [ccRecipients, setCcRecipients] = useState<{ id: string; name: string; email: string }[]>(
    [],
  );
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [notif, setNotif] = useState<BinderNotifications>({
    onStart: true,
    onComplete: true,
    reminders: false,
    reminderEveryHours: 24,
  });

  // Placement step state
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeKind, setActiveKind] = useState<SignatureFieldKind>("signature");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const invalidSignerIds = useMemo(
    () =>
      new Set(
        signers
          .filter((signer) => signer.email.trim() && !isAllowedSignerEmail(signer.email))
          .map((signer) => signer.id),
      ),
    [signers],
  );

  const stepIndex = STEPS.indexOf(step);
  const isBusy = isSubmitting || isSavingDraft;

  const hasDraftContent = useMemo(() => {
    return Boolean(
      name.trim() ||
      description.trim() ||
      group.trim() ||
      documents.length ||
      attachments.length ||
      signers.some((signer) => signer.name.trim() || signer.email.trim()) ||
      ccRecipients.some((c) => c.email.trim() || c.name.trim()) ||
      fields.length,
    );
  }, [
    name,
    description,
    group,
    documents.length,
    attachments.length,
    signers,
    ccRecipients,
    fields.length,
  ]);

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
    setNotif({ onStart: true, onComplete: true, reminders: false, reminderEveryHours: 24 });
    setActiveSignerId(null);
    setActiveDocId(null);
    setActivePage(1);
    setActiveKind("signature");
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!draftBinder) {
      reset();
      return;
    }

    setStep("general");
    setName(draftBinder.name);
    setDescription(draftBinder.description ?? "");
    setGroup(draftBinder.group ?? "");
    setConsolidation(draftBinder.consolidation);
    setDocuments((draftBinder.documents ?? []).map((document) => ({ ...document })));
    setAttachments(draftBinder.attachments ?? []);
    setSigners(draftBinder.signers ?? []);
    setFields(draftBinder.signatureFields ?? []);
    setNotif({
      onStart: draftBinder.notifications?.onStart ?? true,
      onComplete: draftBinder.notifications?.onComplete ?? true,
      reminders: draftBinder.notifications?.reminders ?? false,
      reminderEveryHours: draftBinder.notifications?.reminderEveryHours ?? 24,
    });
    setActiveSignerId(draftBinder.signers?.[0]?.id ?? null);
    setActiveDocId(draftBinder.documents?.[0]?.id ?? null);
    setActivePage(1);
    setActiveKind("signature");
  }, [draftBinder, open]);

  useEffect(() => {
    if (!draftBinder || !open || !activeDocId) {
      return;
    }

    const activeDocument = documents.find((document) => document.id === activeDocId);
    if (!activeDocument || activeDocument.file) {
      return;
    }

    let cancelled = false;

    const loadDocumentFile = async () => {
      try {
        const headers = new Headers();
        const token = getStoredAuthToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetch(
          `${getApiBaseUrl()}/binders/${draftBinder.id}/documents/${activeDocId}/content`,
          {
            headers,
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        if (cancelled) {
          return;
        }

        const file = new File([blob], activeDocument.name, {
          type: blob.type || "application/pdf",
        });

        setDocuments((current) =>
          current.map((document) =>
            document.id === activeDocId ? { ...document, file } : document,
          ),
        );
      } catch {
        // Keep the placeholder preview if the stored PDF cannot be fetched.
      }
    };

    void loadDocumentFile();

    return () => {
      cancelled = true;
    };
  }, [draftBinder, open, activeDocId, documents]);

  const buildPayload = async (saveAsDraft: boolean) => {
    if (invalidSignerIds.size > 0) {
      throw new Error(t("newBinder.signerEmailDomainError"));
    }

    const documentPayloads = await Promise.all(
      documents.map(async ({ id, name: documentName, size, pages, file, content }) => ({
        id,
        name: documentName,
        size,
        pages,
        content: file ? await fileToBase64(file) : content,
      })),
    );

    const normalizedSigners: BinderSigner[] = signers
      .map((signer, index) => ({
        ...signer,
        order: index + 1,
        color: signer.color ?? SIGNER_COLORS[index % SIGNER_COLORS.length],
        status: "pending" as const,
      }))
      .filter((signer) =>
        saveAsDraft ? Boolean(signer.name.trim()) && Boolean(signer.email.trim()) : true,
      );

    const allowedSignerIds = new Set(normalizedSigners.map((signer) => signer.id));
    const allowedDocumentIds = new Set(documentPayloads.map((document) => document.id));
    const normalizedFields = fields.filter(
      (field) => allowedSignerIds.has(field.signerId) && allowedDocumentIds.has(field.documentId),
    );

    return {
      name: name.trim(),
      description: description.trim() || undefined,
      group,
      ownerName: getSession()?.name ?? "",
      ownerEmail: getSession()?.email ?? "",
      ownerInitials: getSession()?.initials ?? "",
      status: saveAsDraft ? ("draft" as const) : undefined,
      documents: documentPayloads,
      attachments,
      signers: normalizedSigners,
      ccRecipients: ccRecipients
        .map((c) => ({ id: c.id, name: c.name?.trim() || undefined, email: c.email.trim() }))
        .filter((c) => (saveAsDraft ? Boolean(c.email) : true)),
      signatureFields: normalizedFields,
      notifications: notif,
      consolidation,
    };
  };

  const saveDraftIfNeeded = async () => {
    if (!hasDraftContent || !name.trim()) {
      return "skipped" as const;
    }

    setIsSavingDraft(true);
    try {
      if (draftBinder) {
        await update(draftBinder.id, await buildPayload(true));
      } else {
        await create(await buildPayload(true));
      }
      toast.success("Brouillon enregistre");
      return "saved" as const;
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          draftBinder
            ? "Mise a jour du brouillon impossible"
            : "Enregistrement du brouillon impossible",
        ),
      );
      return "failed" as const;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleClose = async (v: boolean, options?: { saveDraft?: boolean }) => {
    if (!v) {
      const saveDraft = options?.saveDraft ?? true;
      if (saveDraft) {
        const outcome = await saveDraftIfNeeded();
        if (outcome === "failed") {
          return;
        }
      }
      reset();
      onOpenChange(false);
      return;
    }

    onOpenChange(v);
  };

  const canNext = useMemo(() => {
    if (step === "general") return name.trim().length > 0;
    if (step === "signers")
      return (
        signers.length > 0 &&
        signers.every((s) => s.name.trim() && s.email.trim() && isAllowedSignerEmail(s.email))
      );
    if (step === "placement") return true; // optional
    return true;
  }, [step, name, signers]);

  const goNext = async () => {
    if (!canNext || isBusy) return;
    if (step === "review") {
      await submit();
      return;
    }
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

  const submit = async () => {
    setIsSubmitting(true);
    try {
      let binderId: string;

      if (draftBinder) {
        const savedBinder = await update(draftBinder.id, await buildPayload(true));
        const startedBinder = await startBinder(savedBinder.id);
        binderId = startedBinder.id;
      } else {
        const binder = await create(await buildPayload(false));
        binderId = binder.id;
      }

      // Persist any new signer names into contacts (non-blocking failures)
      const persistNewContacts = async (toPersist: typeof signers) => {
        for (const s of toPersist) {
          const email = s.email?.trim();
          const name = s.name?.trim();
          if (!email || !name) continue;
          const exists = contacts.some((c) => c.email.toLowerCase() === email.toLowerCase());
          if (exists) continue;
          const parts = name.split(/\s+/).filter(Boolean);
          const firstName = parts[0];
          const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
          try {
            await createContact({ firstName, lastName, email });
          } catch (err) {
            // Ignore contact creation failures

            console.warn("createContact failed", err);
          }
        }
      };

      await persistNewContacts(signers);

      await handleClose(false, { saveDraft: false });
      onCreated?.(binderId);
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          draftBinder ? "Demarrage du brouillon impossible" : "Création du parapheur impossible",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPickDocs = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    const accepted = picked.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );

    if (accepted.length !== picked.length) {
      toast.error("Seuls les fichiers PDF peuvent etre ajoutes comme documents a signer.");
    }

    if (accepted.length === 0) {
      return;
    }

    const next: LocalBinderDocument[] = accepted.map((file, index) => ({
      id: `d_${Date.now()}_${index}`,
      name: file.name,
      size: file.size,
      pages: 1,
      file,
      mimeType: file.type,
    }));

    setDocuments((prev) => [...prev, ...next]);
    setActiveDocId((current) => current ?? next[0]?.id ?? null);
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
    setSigners((p) => {
      const next = p
        .filter((x) => x.id !== id)
        .map((x, index) => ({
          ...x,
          order: index + 1,
        }));
      if (activeSignerId === id) {
        setActiveSignerId(next[0]?.id ?? null);
      }
      return next;
    });
    setFields((p) => p.filter((f) => f.signerId !== id));
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const activeSigner = signers.find((s) => s.id === activeSignerId);

  const placePage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSignerId || !activeDocId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    const yRel = (e.clientY - rect.top) / rect.height;
    const w = activeKind === "initial" ? INITIAL_W : ZONE_W;
    const h = activeKind === "initial" ? INITIAL_H : ZONE_H;
    setFields((p) => [
      ...p,
      {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        documentId: activeDocId,
        page: activePage,
        x: Math.max(0, Math.min(1 - w, xRel - w / 2)),
        y: Math.max(0, Math.min(1 - h, yRel - h / 2)),
        width: w,
        height: h,
        signerId: activeSignerId,
        kind: activeKind,
      },
    ]);
  };

  const removeField = (id: string) => setFields((p) => p.filter((f) => f.id !== id));

  const updateField = (id: string, patch: Partial<SignatureField>) =>
    setFields((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const fieldsOnPage = fields.filter((f) => f.documentId === activeDocId && f.page === activePage);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        void handleClose(nextOpen);
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between space-y-0 bg-sidebar px-6 py-4 text-sidebar-foreground [&>button]:hidden">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <FilePlus2 className="h-5 w-5" />
            {draftBinder?.name ?? t("newBinder.title")}
          </DialogTitle>
          <button
            type="button"
            onClick={() => {
              void handleClose(false);
            }}
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
                accept=".pdf,application/pdf"
                hint="PDF"
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
                        setDocuments((p) => {
                          const next = p.filter((x) => x.id !== d.id);
                          if (activeDocId === d.id) {
                            setActiveDocId(next[0]?.id ?? null);
                            setActivePage(1);
                          }
                          return next;
                        });
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
                      onRemove={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "signers" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("newBinder.signerEmailHelp")}</p>
              <p className="text-xs text-muted-foreground">{t("newBinder.orderHint")}</p>
              {signers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  {t("newBinder.noSigners")}
                </p>
              )}
              {signers.map((s, idx) => {
                const color = s.color ?? SIGNER_COLORS[idx % SIGNER_COLORS.length];
                const contactMatch = contacts.find(
                  (contact) =>
                    `${contact.firstName} ${contact.lastName}`.trim() === s.name &&
                    contact.email === s.email,
                );
                return (
                  <div key={s.id} className="space-y-2 rounded-md border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {t("newBinder.signerLabel", { order: idx + 1 })}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSigner(s.id)}
                        className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("newBinder.signerName")}
                        </label>
                        <div className="relative">
                          <Input
                            placeholder={t("newBinder.signerContactPlaceholder")}
                            value={s.name}
                            onFocus={() => setFocusedSignerId(s.id)}
                            onBlur={() =>
                              setTimeout(
                                () => setFocusedSignerId((cur) => (cur === s.id ? null : cur)),
                                150,
                              )
                            }
                            onChange={(e) =>
                              setSigners((prev) =>
                                prev.map((x) =>
                                  x.id === s.id ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          {focusedSignerId === s.id &&
                            s.name.trim() &&
                            (() => {
                              const q = s.name.trim().toLowerCase();
                              const matches = contacts
                                .filter((c) =>
                                  `${c.firstName} ${c.lastName}`.toLowerCase().includes(q),
                                )
                                .slice(0, 8);
                              if (matches.length === 0) return null;
                              return (
                                <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border bg-card p-1 shadow">
                                  {matches.map((contact) => (
                                    <li key={contact.id} className="">
                                      <button
                                        type="button"
                                        onMouseDown={(ev) => ev.preventDefault()}
                                        onClick={() =>
                                          setSigners((prev) =>
                                            prev.map((x) =>
                                              x.id === s.id
                                                ? {
                                                    ...x,
                                                    name: `${contact.firstName} ${contact.lastName}`,
                                                    email: contact.email,
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                        className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                                      >
                                        {contact.firstName} {contact.lastName} · {contact.email}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("newBinder.signerEmail")}
                        </label>
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
                        {s.email.trim() && invalidSignerIds.has(s.id) ? (
                          <p className="text-xs text-destructive">
                            {t("newBinder.signerEmailDomainError")}
                          </p>
                        ) : null}
                      </div>
                    </div>
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

          {step === "notifications" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("newBinder.ccHelp")}</p>
              <div className="space-y-2">
                {ccRecipients.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Input
                      placeholder={t("newBinder.ccName")}
                      value={c.name}
                      onChange={(e) =>
                        setCcRecipients((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder={t("newBinder.ccEmail")}
                      value={c.email}
                      onChange={(e) =>
                        setCcRecipients((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, email: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setCcRecipients((p) => p.filter((x) => x.id !== c.id))}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setCcRecipients((p) => [...p, { id: `cc_${Date.now()}`, name: "", email: "" }])
                  }
                  className="flex items-center gap-2 text-sm text-action"
                >
                  <Plus className="h-4 w-4" /> {t("newBinder.addCc")}
                </button>
              </div>
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
                  <p className="text-sm text-muted-foreground">{t("newBinder.placementHelp")}</p>

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

                  {/* Kind selector: signature vs initial (paraphe) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("newBinder.zoneKind")}
                    </div>
                    <div className="inline-flex rounded-md border bg-card p-0.5">
                      {(["signature", "initial"] as const).map((k) => {
                        const active = activeKind === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setActiveKind(k)}
                            className={cn(
                              "rounded px-3 py-1.5 text-xs font-medium transition",
                              active
                                ? "bg-action text-action-foreground"
                                : "text-foreground hover:bg-accent",
                            )}
                          >
                            {t(`newBinder.kind.${k}` as never)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {activeKind === "initial"
                        ? t("newBinder.kindHelpInitial")
                        : t("newBinder.kindHelpSignature")}
                    </p>
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
                        onClick={() => setActivePage((p) => Math.min(activeDoc.pages ?? 1, p + 1))}
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
                        documentFile={activeDoc.file}
                        onTotalPagesChange={(pages) => {
                          setDocuments((prev) =>
                            prev.map((document) =>
                              document.id === activeDoc.id ? { ...document, pages } : document,
                            ),
                          );
                          setActivePage((current) => Math.min(current, pages));
                        }}
                        onClick={activeSigner ? placePage : undefined}
                      >
                        {fieldsOnPage.map((f) => {
                          const signer = signers.find((s) => s.id === f.signerId);
                          const color = signer?.color ?? "#0EA5E9";
                          const isInitial = f.kind === "initial";
                          const baseLabel = signer?.name?.split(" ")[0] || `#${signer?.order}`;
                          const label = isInitial
                            ? `${t("newBinder.kind.initial")} · ${baseLabel}`
                            : baseLabel;
                          return (
                            <ResizableField
                              key={f.id}
                              field={f}
                              color={color}
                              label={label}
                              onChange={(patch) => updateField(f.id, patch)}
                              onRemove={() => removeField(f.id)}
                            />
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
              {notif.reminders && (
                <Field label={t("newBinder.reminderFrequency")}>
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={1}
                      value={notif.reminderEveryHours ?? 24}
                      onChange={(e) =>
                        setNotif((current) => ({
                          ...current,
                          reminderEveryHours: Math.max(1, Number(e.target.value) || 24),
                        }))
                      }
                      className="max-w-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("newBinder.reminderFrequencyHelp")}
                    </p>
                  </div>
                </Field>
              )}
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
                    notif.reminders &&
                      `${t("newBinder.notifyOnReminder")} (${t("newBinder.reminderEveryHours", {
                        count: notif.reminderEveryHours ?? 24,
                      })})`,
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void handleClose(false);
            }}
            disabled={isBusy}
          >
            {t("common.cancel")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={stepIndex === 0 || isBusy}
            >
              {t("newBinder.back")}
            </Button>
            <Button
              type="button"
              onClick={() => void goNext()}
              disabled={!canNext || isBusy}
              className="bg-action text-action-foreground hover:opacity-90"
            >
              {step === "review"
                ? draftBinder
                  ? t("detail.startBinder")
                  : t("newBinder.create")
                : t("newBinder.next")}
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
  hint,
  onPick,
  icon: Icon,
}: {
  label: string;
  accept: string;
  hint?: string;
  onPick: (files: FileList | null) => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-action/40 bg-action/5 p-8 text-center transition hover:bg-action/10">
      <Icon className="h-6 w-6 text-action" />
      <span className="text-sm font-medium text-action">{label}</span>
      <span className="text-xs text-muted-foreground">{hint ?? "PDF, DOCX, ZIP…"}</span>
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
          <span className="text-xs text-muted-foreground">{(size / 1024).toFixed(1)} KB</span>
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

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

const MIN_W = 0.06;
const MIN_H = 0.025;

function ResizableField({
  field,
  color,
  label,
  onChange,
  onRemove,
}: {
  field: SignatureField;
  color: string;
  label: string;
  onChange: (patch: Partial<SignatureField>) => void;
  onRemove: () => void;
}) {
  const startDrag = (e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const parent =
      target.closest<HTMLElement>("[data-page-surface]") ??
      (target.offsetParent as HTMLElement | null);
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: field.x, y: field.y, w: field.width, h: field.height };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      let { x, y, w, h } = start;
      if (handle === "move") {
        x = Math.max(0, Math.min(1 - w, start.x + dx));
        y = Math.max(0, Math.min(1 - h, start.y + dy));
      } else {
        if (handle.includes("e")) w = Math.max(MIN_W, Math.min(1 - start.x, start.w + dx));
        if (handle.includes("s")) h = Math.max(MIN_H, Math.min(1 - start.y, start.h + dy));
        if (handle.includes("w")) {
          const nw = Math.max(MIN_W, start.w - dx);
          x = Math.max(0, start.x + (start.w - nw));
          w = nw;
        }
        if (handle.includes("n")) {
          const nh = Math.max(MIN_H, start.h - dy);
          y = Math.max(0, start.y + (start.h - nh));
          h = nh;
        }
      }
      onChange({ x, y, width: w, height: h });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handles: { key: Handle; cls: string }[] = [
    { key: "nw", cls: "-left-1 -top-1 cursor-nwse-resize" },
    { key: "n", cls: "left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize" },
    { key: "ne", cls: "-right-1 -top-1 cursor-nesw-resize" },
    { key: "e", cls: "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
    { key: "se", cls: "-right-1 -bottom-1 cursor-nwse-resize" },
    { key: "s", cls: "left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize" },
    { key: "sw", cls: "-left-1 -bottom-1 cursor-nesw-resize" },
    { key: "w", cls: "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  ];

  return (
    <div
      onPointerDown={(e) => startDrag(e, "move")}
      onClick={(e) => e.stopPropagation()}
      className="group absolute flex cursor-move select-none items-center justify-between rounded border-2 px-1.5 text-[9px] font-semibold uppercase shadow-sm"
      style={{
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        borderColor: color,
        backgroundColor: `${color}25`,
        color,
        touchAction: "none",
      }}
    >
      <span className="pointer-events-none truncate">{label}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded p-0.5 hover:bg-white/40"
        aria-label="Remove"
      >
        <X className="h-2.5 w-2.5" />
      </button>
      {handles.map((h) => (
        <span
          key={h.key}
          onPointerDown={(e) => startDrag(e, h.key)}
          className={cn(
            "absolute h-2 w-2 rounded-sm border bg-white opacity-0 transition group-hover:opacity-100",
            h.cls,
          )}
          style={{ borderColor: color, touchAction: "none" }}
        />
      ))}
    </div>
  );
}
