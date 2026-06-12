import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  X,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Download,
  HelpCircle,
  Users,
  FileText,
  Paperclip,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Trash2,
  Lock,
  Play,
  Check,
  History,
  XCircle,
  BellRing,
  Mail,
  Eye,
  ShieldCheck,
  FileSignature,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentPagePreview } from "@/components/DocumentPagePreview";
import { StatusBadge } from "@/components/StatusBadge";
import { useBinders } from "@/lib/store";
import { getApiBaseUrl, getErrorMessage, getStoredAuthToken } from "@/lib/api";
import { isAllowedSignerEmail } from "@/lib/email";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { generateSignedPdf, generateCertificatePdf } from "@/lib/evidence";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  SIGNER_COLORS,
  type AuditEvent,
  type AuditEventKind,
  type BinderAttachment,
  type BinderDocument,
  type BinderSigner,
  type SignatureField,
  type SignatureFieldKind,
} from "@/lib/mockData";

export const Route = createFileRoute("/binders/detail/$id")({
  head: () => ({ meta: [{ title: "Détail parapheur — Usign" }] }),
  component: BinderDetail,
});

type Tab = "general" | "steps" | "documents" | "history" | "notifications" | "operations";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

const ZONE_W = 0.22;
const ZONE_H = 0.06;
const INITIAL_W = 0.09;
const INITIAL_H = 0.05;
const MIN_W = 0.06;
const MIN_H = 0.025;

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

function BinderDetail() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const {
    binders,
    update,
    startBinder: startBinderAction,
    recordDownload,
    updateSignerInvitationEmail,
  } = useBinders();
  const navigate = useNavigate();
  const session = getSession();
  const sessionEmail = session?.email.trim().toLowerCase() ?? null;
  const binder = binders.find((b) => b.id === id);
  const editable = binder?.status === "draft";
  const [tab, setTab] = useState<Tab>("general");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<null | "name" | "description" | "group">(null);
  const [draftValue, setDraftValue] = useState("");
  const [editingSignerEmailId, setEditingSignerEmailId] = useState<string | null>(null);
  const [draftSignerEmail, setDraftSignerEmail] = useState("");
  const [savingSignerEmailId, setSavingSignerEmailId] = useState<string | null>(null);
  const [newSignerName, setNewSignerName] = useState("");
  const [newSignerEmail, setNewSignerEmail] = useState("");
  const [isAddingSigner, setIsAddingSigner] = useState(false);
  const [reminderFrequencyDraft, setReminderFrequencyDraft] = useState("24");
  const [placementSignerId, setPlacementSignerId] = useState<string | null>(null);
  const [placementDocId, setPlacementDocId] = useState<string | null>(null);
  const [placementPage, setPlacementPage] = useState(1);
  const [placementKind, setPlacementKind] = useState<SignatureFieldKind>("signature");
  const [draftSignatureFields, setDraftSignatureFields] = useState<SignatureField[]>([]);
  const [signatureFieldsDirty, setSignatureFieldsDirty] = useState(false);
  const [isSavingSignatureFields, setIsSavingSignatureFields] = useState(false);
  const [draftDocumentFiles, setDraftDocumentFiles] = useState<Record<string, File>>({});
  const [documentPageCounts, setDocumentPageCounts] = useState<Record<string, number>>({});
  const docInputRef = useRef<HTMLInputElement>(null);
  const attInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!binder) {
      return;
    }

    setReminderFrequencyDraft(String(binder.notifications?.reminderEveryHours ?? 24));
  }, [binder]);

  useEffect(() => {
    if (!binder) {
      return;
    }

    setDraftDocumentFiles({});
    setDocumentPageCounts({});
    setPlacementPage(1);
    setPlacementKind("signature");
    setSignatureFieldsDirty(false);
  }, [binder?.id]);

  useEffect(() => {
    if (!binder || signatureFieldsDirty) {
      return;
    }

    setDraftSignatureFields(binder.signatureFields ?? []);
  }, [binder, signatureFieldsDirty]);

  useEffect(() => {
    const documents = binder?.documents ?? [];

    if (documents.length === 0) {
      setPlacementDocId(null);
      return;
    }

    if (!placementDocId || !documents.some((document) => document.id === placementDocId)) {
      setPlacementDocId(documents[0].id);
      setPlacementPage(1);
    }
  }, [binder?.documents, placementDocId]);

  useEffect(() => {
    const signers = binder?.signers ?? [];

    if (signers.length === 0) {
      setPlacementSignerId(null);
      return;
    }

    if (!placementSignerId || !signers.some((signer) => signer.id === placementSignerId)) {
      setPlacementSignerId(signers[0].id);
    }
  }, [binder?.signers, placementSignerId]);

  useEffect(() => {
    if (!binder || !editable || !placementDocId || draftDocumentFiles[placementDocId]) {
      return;
    }

    const activeDocument = (binder.documents ?? []).find(
      (document) => document.id === placementDocId,
    );
    if (!activeDocument) {
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
          `${getApiBaseUrl()}/binders/${binder.id}/documents/${placementDocId}/content`,
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

        setDraftDocumentFiles((current) => {
          if (current[placementDocId]) {
            return current;
          }

          return { ...current, [placementDocId]: file };
        });
      } catch {
        // Fall back to the placeholder preview when document bytes are unavailable.
      }
    };

    void loadDocumentFile();

    return () => {
      cancelled = true;
    };
  }, [binder, editable, placementDocId, draftDocumentFiles]);

  useEffect(() => {
    if (!binder || !placementDocId) {
      return;
    }

    const activeDocument = (binder.documents ?? []).find(
      (document) => document.id === placementDocId,
    );
    const pageCount = Math.max(1, documentPageCounts[placementDocId] ?? activeDocument?.pages ?? 1);

    if (placementPage > pageCount) {
      setPlacementPage(pageCount);
    }
  }, [binder, placementDocId, placementPage, documentPageCounts]);

  if (!binder) {
    return (
      <AppShell>
        <div className="text-center text-muted-foreground">
          Parapheur introuvable.{" "}
          <Link to="/binders/$status" params={{ status: "all" }} className="text-action underline">
            Retour
          </Link>
        </div>
      </AppShell>
    );
  }

  const fmt = (iso?: string) => formatDateTime(iso, i18n.language);
  const documents = binder.documents ?? [];
  const signers = binder.signers ?? [];
  const activePlacementDocument =
    documents.find((document) => document.id === placementDocId) ?? documents[0] ?? null;
  const activePlacementSigner =
    signers.find((signer) => signer.id === placementSignerId) ?? signers[0] ?? null;
  const activePlacementFile = activePlacementDocument
    ? draftDocumentFiles[activePlacementDocument.id]
    : undefined;
  const activePlacementPageCount = activePlacementDocument
    ? Math.max(
        1,
        documentPageCounts[activePlacementDocument.id] ?? activePlacementDocument.pages ?? 1,
      )
    : 1;
  const activePlacementFields = activePlacementDocument
    ? draftSignatureFields.filter(
        (field) => field.documentId === activePlacementDocument.id && field.page === placementPage,
      )
    : [];
  const displayedSignatureFields = editable ? draftSignatureFields : (binder.signatureFields ?? []);

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: t("detail.tabs.general") },
    { key: "steps", label: t("detail.tabs.steps") },
    { key: "documents", label: t("detail.tabs.documents") },
    { key: "history", label: t("history.title") },
    { key: "notifications", label: t("detail.tabs.notifications") },
    { key: "operations", label: t("detail.tabs.operations") },
  ];

  const buildSignLink = (signerId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/sign/${binder.id}/${signerId}`;
  };

  const canOpenSignPage = (signerEmail: string) =>
    sessionEmail === signerEmail.trim().toLowerCase();

  const copyLink = async (signerId: string) => {
    const url = buildSignLink(signerId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(signerId);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const startEdit = (field: "name" | "description" | "group", current: string) => {
    if (!editable) return;
    setEditingField(field);
    setDraftValue(current);
  };
  const commitEdit = () => {
    if (!editingField) return;
    update(binder.id, { [editingField]: draftValue.trim() || undefined } as Partial<typeof binder>);
    setEditingField(null);
  };
  const cancelEdit = () => setEditingField(null);

  const cancelSignerEmailEdit = () => {
    setEditingSignerEmailId(null);
    setDraftSignerEmail("");
  };

  const startSignerEmailEdit = (signer: BinderSigner) => {
    setEditingSignerEmailId(signer.id);
    setDraftSignerEmail(signer.email);
  };

  const submitSignerEmailEdit = async (signer: BinderSigner) => {
    if (!draftSignerEmail.trim()) {
      toast.error(t("detail.inviteEmailUpdateError"));
      return;
    }

    if (!isAllowedSignerEmail(draftSignerEmail)) {
      toast.error(t("detail.inviteEmailDomainError"));
      return;
    }

    setSavingSignerEmailId(signer.id);
    try {
      await updateSignerInvitationEmail(binder.id, signer.id, draftSignerEmail.trim());
      toast.success(t("detail.inviteEmailUpdated"));
      cancelSignerEmailEdit();
    } catch (error) {
      toast.error(getErrorMessage(error, t("detail.inviteEmailUpdateError")));
    } finally {
      setSavingSignerEmailId(null);
    }
  };

  const toggleConsolidation = () => {
    if (!editable) return;
    update(binder.id, { consolidation: !binder.consolidation });
  };

  const toggleNotif = (key: "onStart" | "onComplete" | "reminders") => {
    if (!editable) return;
    const current = binder.notifications ?? {
      onStart: true,
      onComplete: true,
      reminders: false,
      reminderEveryHours: 24,
    };
    update(binder.id, { notifications: { ...current, [key]: !current[key] } });
  };

  const removeSigner = (signerId: string) => {
    if (!editable) return;
    if (!window.confirm(t("detail.confirmRemoveSigner"))) return;
    const signers = (binder.signers ?? []).filter((s) => s.id !== signerId);
    const signatureFields = draftSignatureFields.filter((field) => field.signerId !== signerId);
    void update(binder.id, { signers, signatureFields })
      .then((updatedBinder) => {
        setDraftSignatureFields(updatedBinder.signatureFields ?? []);
        setSignatureFieldsDirty(false);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
      });
  };

  const addSignerRow = () => {
    if (!editable) return;

    if (!newSignerName.trim()) {
      toast.error(t("detail.addSignerNameRequired"));
      return;
    }

    if (!newSignerEmail.trim()) {
      toast.error(t("detail.addSignerEmailRequired"));
      return;
    }

    if (!isAllowedSignerEmail(newSignerEmail)) {
      toast.error(t("detail.inviteEmailDomainError"));
      return;
    }

    const list = binder.signers ?? [];
    const order = list.length + 1;
    const color = SIGNER_COLORS[list.length % SIGNER_COLORS.length];
    const newSigner: BinderSigner = {
      id: `s_${Date.now()}`,
      order,
      name: newSignerName.trim(),
      email: newSignerEmail.trim(),
      color,
      status: "pending",
    };

    setIsAddingSigner(true);
    void update(binder.id, {
      signers: [...list, newSigner],
      ...(signatureFieldsDirty ? { signatureFields: draftSignatureFields } : {}),
    })
      .then((updatedBinder) => {
        setNewSignerName("");
        setNewSignerEmail("");
        setDraftSignatureFields(updatedBinder.signatureFields ?? []);
        setSignatureFieldsDirty(false);
        setPlacementSignerId(updatedBinder.signers?.at(-1)?.id ?? null);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, t("detail.addSignerError")));
      })
      .finally(() => {
        setIsAddingSigner(false);
      });
  };

  const updateReminderFrequency = () => {
    if (!editable) return;

    const nextValue = Math.max(1, Number(reminderFrequencyDraft) || 24);
    const current = binder.notifications ?? {
      onStart: true,
      onComplete: true,
      reminders: true,
      reminderEveryHours: 24,
    };

    setReminderFrequencyDraft(String(nextValue));
    void update(binder.id, {
      notifications: {
        ...current,
        reminders: true,
        reminderEveryHours: nextValue,
      },
    }).catch((error) => {
      toast.error(getErrorMessage(error, t("detail.reminderFrequencyUpdateError")));
    });
  };

  const updateSignerField = (signerId: string, patch: Partial<BinderSigner>) => {
    if (!editable) return;
    const signers = (binder.signers ?? []).map((s) => (s.id === signerId ? { ...s, ...patch } : s));
    void update(binder.id, {
      signers,
      ...(signatureFieldsDirty ? { signatureFields: draftSignatureFields } : {}),
    })
      .then((updatedBinder) => {
        if (!signatureFieldsDirty) {
          return;
        }

        setDraftSignatureFields(updatedBinder.signatureFields ?? []);
        setSignatureFieldsDirty(false);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
      });
  };

  const removeDocument = (docId: string) => {
    if (!editable) return;
    if (!window.confirm(t("detail.confirmRemoveDocument"))) return;
    const documents = (binder.documents ?? []).filter((d) => d.id !== docId);
    const signatureFields = draftSignatureFields.filter((field) => field.documentId !== docId);
    void update(binder.id, { documents, signatureFields })
      .then((updatedBinder) => {
        setDraftSignatureFields(updatedBinder.signatureFields ?? []);
        setSignatureFieldsDirty(false);
        setDraftDocumentFiles((current) => {
          const next = { ...current };
          delete next[docId];
          return next;
        });
        setDocumentPageCounts((current) => {
          const next = { ...current };
          delete next[docId];
          return next;
        });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
      });
  };

  const onPickDocs = async (files: FileList | null) => {
    if (!files || !editable) return;
    const selectedFiles = Array.from(files);

    try {
      const next: BinderDocument[] = await Promise.all(
        selectedFiles.map(async (file, index) => ({
          id: `d_${Date.now()}_${index}`,
          name: file.name,
          size: file.size,
          pages: 1,
          content: await fileToBase64(file),
        })),
      );

      const updatedBinder = await update(binder.id, {
        documents: [...(binder.documents ?? []), ...next],
        ...(signatureFieldsDirty ? { signatureFields: draftSignatureFields } : {}),
      });

      const createdDocuments = updatedBinder.documents?.slice(-next.length) ?? [];
      setDraftSignatureFields(updatedBinder.signatureFields ?? []);
      setSignatureFieldsDirty(false);
      setDraftDocumentFiles((current) => {
        const mapped = { ...current };
        createdDocuments.forEach((document, index) => {
          const sourceFile = selectedFiles[index];
          if (document && sourceFile) {
            mapped[document.id] = sourceFile;
          }
        });
        return mapped;
      });

      const lastCreatedDocument = createdDocuments.at(-1);
      if (lastCreatedDocument) {
        setPlacementDocId(lastCreatedDocument.id);
        setPlacementPage(1);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const patchDraftSignatureField = (fieldId: string, patch: Partial<SignatureField>) => {
    setDraftSignatureFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
    );
    setSignatureFieldsDirty(true);
  };

  const removeDraftSignatureField = (fieldId: string) => {
    setDraftSignatureFields((current) => current.filter((field) => field.id !== fieldId));
    setSignatureFieldsDirty(true);
  };

  const placeDraftSignatureField = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !activePlacementDocument || !activePlacementSigner) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const width = placementKind === "initial" ? INITIAL_W : ZONE_W;
    const height = placementKind === "initial" ? INITIAL_H : ZONE_H;
    const x = Math.max(
      0,
      Math.min(1 - width, (event.clientX - rect.left) / rect.width - width / 2),
    );
    const y = Math.max(
      0,
      Math.min(1 - height, (event.clientY - rect.top) / rect.height - height / 2),
    );

    setDraftSignatureFields((current) => [
      ...current,
      {
        id: `f_${Date.now()}`,
        documentId: activePlacementDocument.id,
        signerId: activePlacementSigner.id,
        page: placementPage,
        kind: placementKind,
        x,
        y,
        width,
        height,
      },
    ]);
    setSignatureFieldsDirty(true);
  };

  const saveDraftSignatureFields = async () => {
    if (!editable) {
      return;
    }

    setIsSavingSignatureFields(true);
    try {
      const updatedBinder = await update(binder.id, { signatureFields: draftSignatureFields });
      setDraftSignatureFields(updatedBinder.signatureFields ?? []);
      setSignatureFieldsDirty(false);
      toast.success(t("detail.zonesSaved"));
    } catch (error) {
      toast.error(getErrorMessage(error, t("detail.zonesSaveError")));
    } finally {
      setIsSavingSignatureFields(false);
    }
  };

  const removeAttachment = (attId: string) => {
    if (!editable) return;
    if (!window.confirm(t("detail.confirmRemoveAttachment"))) return;
    const attachments = (binder.attachments ?? []).filter((a) => a.id !== attId);
    update(binder.id, { attachments });
  };

  const onPickAttachments = (files: FileList | null) => {
    if (!files || !editable) return;
    const next: BinderAttachment[] = Array.from(files).map((f, i) => ({
      id: `a_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
    }));
    update(binder.id, { attachments: [...(binder.attachments ?? []), ...next] });
  };

  const startBinder = () => {
    if (!editable) return;
    // Use the store action so audit events (started + invited per signer)
    // are logged consistently.
    startBinderAction(binder.id);
  };

  const onDownloadSigned = () => {
    void generateSignedPdf(binder, i18n.language)
      .then(() =>
        recordDownload(binder.id, { name: session?.name, email: session?.email }, "signed_pdf"),
      )
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Téléchargement impossible");
      });
  };
  const onDownloadCertificate = () => {
    generateCertificatePdf(binder, i18n.language);
    recordDownload(binder.id, { name: session?.name, email: session?.email }, "certificate");
  };

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
                onClick={() =>
                  navigate({ to: "/binders/$status", params: { status: binder.status } })
                }
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
          {/* Edit-mode banner */}
          <div
            className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm ${
              editable
                ? "border-action/30 bg-action/5 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {editable ? (
              <>
                <Pencil className="h-4 w-4 text-action" />
                <span className="flex-1">{t("detail.editableHint")}</span>
                <Button size="sm" onClick={startBinder} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" /> {t("detail.startBinder")}
                </Button>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>{t("detail.lockedHint")}</span>
              </>
            )}
          </div>

          {tab === "general" && (
            <Section title={t("detail.tabs.general")}>
              <Row label={t("newBinder.name")}>
                {editingField === "name" ? (
                  <InlineEditor
                    value={draftValue}
                    onChange={setDraftValue}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <>
                    <span className="text-sm text-foreground">{binder.name}</span>
                    {editable && (
                      <button
                        onClick={() => startEdit("name", binder.name)}
                        aria-label={t("detail.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-action" />
                      </button>
                    )}
                  </>
                )}
              </Row>
              <Row label={t("newBinder.description")}>
                {editingField === "description" ? (
                  <InlineEditor
                    value={draftValue}
                    onChange={setDraftValue}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    multiline
                  />
                ) : (
                  <>
                    <span className="text-sm text-foreground">{binder.description ?? "—"}</span>
                    {editable && (
                      <button
                        onClick={() => startEdit("description", binder.description ?? "")}
                        aria-label={t("detail.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-action" />
                      </button>
                    )}
                  </>
                )}
              </Row>
              <Row label={t("detail.owner")}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {binder.ownerInitials}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-foreground">{binder.ownerName}</div>
                  <div className="text-xs text-muted-foreground">{binder.ownerEmail}</div>
                </div>
              </Row>
              <Row label={t("detail.group")}>
                <Users className="h-4 w-4 text-foreground" />
                {editingField === "group" ? (
                  <InlineEditor
                    value={draftValue}
                    onChange={setDraftValue}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <>
                    <span className="text-sm text-foreground">{binder.group}</span>
                    {editable && (
                      <button
                        onClick={() => startEdit("group", binder.group)}
                        aria-label={t("detail.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-action" />
                      </button>
                    )}
                  </>
                )}
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
                {editable ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={binder.consolidation}
                      onCheckedChange={toggleConsolidation}
                    />
                    {binder.consolidation ? t("common.yes") : t("common.no")}
                  </label>
                ) : (
                  <span className="text-sm text-foreground">
                    {binder.consolidation ? t("common.yes") : t("common.no")}
                  </span>
                )}
              </Row>
            </Section>
          )}

          {/* Signers + signing links */}
          {(tab === "steps" || tab === "general") && (
            <Section title={t("detail.signersTitle")}>
              {(binder.signers?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("newBinder.noSigners")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {binder.signers?.map((s, i) => {
                    const color = s.color ?? SIGNER_COLORS[i % SIGNER_COLORS.length];
                    const zoneCount = displayedSignatureFields.filter(
                      (f) => f.signerId === s.id,
                    ).length;
                    const signed = s.status === "signed";
                    const canFixInvitationEmail =
                      !editable && s.status === "pending" && s.inviteEmailStatus === "failed";
                    const isEditingSignerEmail = editingSignerEmailId === s.id;
                    const isSavingSignerEmail = savingSignerEmailId === s.id;
                    return (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2.5"
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {i + 1}
                        </div>
                        {editable ? (
                          <div className="flex flex-1 flex-col gap-1.5 sm:flex-row">
                            <Input
                              value={s.name}
                              onChange={(e) => updateSignerField(s.id, { name: e.target.value })}
                              placeholder={t("newBinder.signerName")}
                              className="h-8 flex-1 text-sm"
                            />
                            <Input
                              value={s.email}
                              onChange={(e) => updateSignerField(s.id, { email: e.target.value })}
                              placeholder={t("newBinder.signerEmail")}
                              className="h-8 flex-1 text-sm"
                            />
                          </div>
                        ) : (
                          <div className="flex-1 leading-tight">
                            <div className="text-sm font-medium text-foreground">{s.name}</div>
                            {isEditingSignerEmail ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Input
                                  value={draftSignerEmail}
                                  onChange={(e) => setDraftSignerEmail(e.target.value)}
                                  placeholder={t("newBinder.signerEmail")}
                                  className="h-8 w-full max-w-sm text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => submitSignerEmailEdit(s)}
                                  disabled={isSavingSignerEmail}
                                >
                                  {isSavingSignerEmail
                                    ? t("detail.savingInviteEmail")
                                    : t("detail.saveInviteEmail")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelSignerEmailEdit}
                                  disabled={isSavingSignerEmail}
                                >
                                  {t("common.cancel")}
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">{s.email}</div>
                            )}
                            {!isEditingSignerEmail &&
                            s.inviteEmailStatus === "sent" &&
                            s.inviteEmailSentAt ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {t("detail.inviteEmailSentAt", { date: fmt(s.inviteEmailSentAt) })}
                              </div>
                            ) : null}
                            {!isEditingSignerEmail &&
                            s.inviteEmailStatus === "failed" &&
                            s.inviteEmailError ? (
                              <div className="mt-1 text-[11px] text-destructive">
                                {s.inviteEmailError}
                              </div>
                            ) : null}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            {zoneCount} {t("detail.zonesAssigned").toLowerCase()}
                          </span>
                          {signed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-action/15 px-2 py-0.5 text-action">
                              <CheckCircle2 className="h-3 w-3" /> {t("detail.signed")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                              <Clock className="h-3 w-3" /> {t("detail.pending")}
                            </span>
                          )}
                          {s.inviteEmailStatus === "sent" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                              <Mail className="h-3 w-3" /> {t("detail.inviteEmailSent")}
                            </span>
                          )}
                          {s.inviteEmailStatus === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                              <Mail className="h-3 w-3" /> {t("detail.inviteEmailPending")}
                            </span>
                          )}
                          {s.inviteEmailStatus === "failed" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                              <XCircle className="h-3 w-3" /> {t("detail.inviteEmailFailed")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {canFixInvitationEmail && !isEditingSignerEmail && (
                            <button
                              onClick={() => startSignerEmailEdit(s)}
                              className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("detail.editInviteEmail")}
                            </button>
                          )}
                          <button
                            onClick={() => copyLink(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === s.id ? t("common.copied") : t("detail.copyLink")}
                          </button>
                          {canOpenSignPage(s.email) && (
                            <Link
                              to="/sign/$binderId/$signerId"
                              params={{ binderId: binder.id, signerId: s.id }}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-md bg-action px-2.5 py-1.5 text-xs font-medium text-action-foreground hover:opacity-90"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> {t("detail.openLink")}
                            </Link>
                          )}
                          {editable && (
                            <button
                              onClick={() => removeSigner(s.id)}
                              className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                              aria-label={t("detail.remove")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {editable && (
                <div className="mt-4 rounded-md border border-dashed border-action/40 bg-action/5 p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-start">
                    <Input
                      value={newSignerName}
                      onChange={(e) => setNewSignerName(e.target.value)}
                      placeholder={t("newBinder.signerName")}
                      className="h-9"
                    />
                    <Input
                      value={newSignerEmail}
                      onChange={(e) => setNewSignerEmail(e.target.value)}
                      placeholder={t("newBinder.signerEmail")}
                      className="h-9"
                    />
                    <Button onClick={addSignerRow} disabled={isAddingSigner} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t("detail.addSigner")}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("newBinder.signerEmailHelp")}
                  </p>
                </div>
              )}
            </Section>
          )}

          {(tab === "documents" || tab === "general") && (
            <Section title={t("detail.documentsTitle")}>
              {(binder.documents?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("newBinder.noDocuments")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {binder.documents?.map((d) => {
                    const zones = displayedSignatureFields.filter(
                      (f) => f.documentId === d.id,
                    ).length;
                    return (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5"
                      >
                        <FileText className="h-4 w-4 text-action" />
                        <span className="flex-1 text-sm text-foreground">{d.name}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {zones} {t("detail.zonesAssigned").toLowerCase()}
                        </span>
                        {editable && (
                          <button
                            onClick={() => removeDocument(d.id)}
                            className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                            aria-label={t("detail.remove")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {editable && (
                <>
                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      onPickDocs(e.target.files);
                      if (docInputRef.current) docInputRef.current.value = "";
                    }}
                  />
                  <button
                    onClick={() => docInputRef.current?.click()}
                    className="mx-auto mt-4 flex items-center gap-2 py-2 text-sm font-medium text-action hover:underline"
                  >
                    <Plus className="h-4 w-4" /> {t("detail.addDocument")}
                  </button>
                </>
              )}

              {((binder.attachments?.length ?? 0) > 0 || editable) && (
                <div className="mt-6">
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t("detail.attachmentsTitle")}
                  </h4>
                  {(binder.attachments?.length ?? 0) > 0 ? (
                    <ul className="space-y-2">
                      {binder.attachments?.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-sm text-foreground">{a.name}</span>
                          {editable && (
                            <button
                              onClick={() => removeAttachment(a.id)}
                              className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                              aria-label={t("detail.remove")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("newBinder.noAttachments")}</p>
                  )}
                  {editable && (
                    <>
                      <input
                        ref={attInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          onPickAttachments(e.target.files);
                          if (attInputRef.current) attInputRef.current.value = "";
                        }}
                      />
                      <button
                        onClick={() => attInputRef.current?.click()}
                        className="mx-auto mt-3 flex items-center gap-2 py-2 text-sm font-medium text-action hover:underline"
                      >
                        <Plus className="h-4 w-4" /> {t("detail.addAttachment")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </Section>
          )}

          {tab === "documents" && editable && (
            <Section title={t("newBinder.steps.placement")}>
              {documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("newBinder.placementNoDocs")}
                </p>
              ) : signers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("newBinder.placementNoSigners")}
                </p>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("detail.documentsTitle")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {documents.map((document) => {
                          const isActive = document.id === activePlacementDocument?.id;
                          return (
                            <button
                              key={document.id}
                              onClick={() => {
                                setPlacementDocId(document.id);
                                setPlacementPage(1);
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-left text-sm transition",
                                isActive
                                  ? "border-action bg-action/10 text-action"
                                  : "border-border bg-background text-foreground hover:bg-accent",
                              )}
                            >
                              {document.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("newBinder.selectSigner")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {signers.map((signer, index) => {
                          const color = signer.color ?? SIGNER_COLORS[index % SIGNER_COLORS.length];
                          const isActive = signer.id === activePlacementSigner?.id;
                          return (
                            <button
                              key={signer.id}
                              onClick={() => setPlacementSignerId(signer.id)}
                              className="rounded-full border px-3 py-1.5 text-sm transition"
                              style={{
                                borderColor: color,
                                backgroundColor: isActive ? `${color}18` : "transparent",
                                color,
                              }}
                            >
                              {signer.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("newBinder.zoneKind")}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {(["signature", "initial"] as const).map((kind) => (
                          <button
                            key={kind}
                            onClick={() => setPlacementKind(kind)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              placementKind === kind
                                ? "border-action bg-action/10 text-action"
                                : "border-border bg-background text-foreground hover:bg-accent",
                            )}
                          >
                            {t(`newBinder.kind.${kind}`)}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {placementKind === "signature"
                          ? t("newBinder.kindHelpSignature")
                          : t("newBinder.kindHelpInitial")}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("newBinder.page")}
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {placementPage} / {activePlacementPageCount}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPlacementPage((current) => Math.max(1, current - 1))}
                            disabled={placementPage <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPlacementPage((current) =>
                                Math.min(activePlacementPageCount, current + 1),
                              )
                            }
                            disabled={placementPage >= activePlacementPageCount}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                        {t("newBinder.zonesCount", { count: activePlacementFields.length })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-action/20 bg-action/5 p-4">
                      <p className="text-sm text-foreground">{t("newBinder.placementHelp")}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("newBinder.clickToPlace")}
                      </p>
                      <Button
                        onClick={() => void saveDraftSignatureFields()}
                        disabled={!signatureFieldsDirty || isSavingSignatureFields}
                        className="mt-4 w-full"
                      >
                        {isSavingSignatureFields ? t("detail.savingZones") : t("detail.saveZones")}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {activePlacementDocument && (
                      <DocumentPagePreview
                        documentName={activePlacementDocument.name}
                        page={placementPage}
                        totalPages={activePlacementPageCount}
                        documentFile={activePlacementFile}
                        className="mx-auto w-full max-w-3xl"
                        onClick={placeDraftSignatureField}
                        onTotalPagesChange={(pages) => {
                          setDocumentPageCounts((current) =>
                            current[activePlacementDocument.id] === pages
                              ? current
                              : { ...current, [activePlacementDocument.id]: pages },
                          );
                        }}
                      >
                        {activePlacementFields.map((field, index) => {
                          const signer = signers.find((item) => item.id === field.signerId);
                          const color =
                            signer?.color ?? SIGNER_COLORS[index % SIGNER_COLORS.length];

                          return (
                            <ResizableField
                              key={field.id}
                              field={field}
                              color={color}
                              label={
                                signer?.name ??
                                t(
                                  field.kind === "initial"
                                    ? "newBinder.kind.initial"
                                    : "newBinder.kind.signature",
                                )
                              }
                              onChange={(patch) => patchDraftSignatureField(field.id, patch)}
                              onRemove={() => removeDraftSignatureField(field.id)}
                            />
                          );
                        })}
                      </DocumentPagePreview>
                    )}
                    <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                      {activePlacementDocument
                        ? `${activePlacementDocument.name} • ${t("newBinder.zonesCount", {
                            count: displayedSignatureFields.filter(
                              (field) => field.documentId === activePlacementDocument.id,
                            ).length,
                          })}`
                        : t("newBinder.placementNoDocs")}
                    </div>
                  </div>
                </div>
              )}
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
              </div>
              {(["onStart", "onComplete", "reminders"] as const).map((key) => {
                const labelKey =
                  key === "onStart"
                    ? "newBinder.notifyOnStart"
                    : key === "onComplete"
                      ? "newBinder.notifyOnComplete"
                      : "newBinder.notifyOnReminder";
                const checked =
                  binder.notifications?.[key] ??
                  (key === "onStart" || key === "onComplete" ? true : false);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 py-1.5 text-sm ${
                      editable ? "cursor-pointer text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleNotif(key)}
                      disabled={!editable}
                    />
                    {t(labelKey)}
                  </label>
                );
              })}
              {binder.notifications?.reminders ? (
                editable ? (
                  <div className="space-y-2 pt-1">
                    <Input
                      type="number"
                      min={1}
                      value={reminderFrequencyDraft}
                      onChange={(e) => setReminderFrequencyDraft(e.target.value)}
                      onBlur={updateReminderFrequency}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          updateReminderFrequency();
                        }
                      }}
                      className="max-w-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("newBinder.reminderFrequencyHelp")}
                    </p>
                  </div>
                ) : binder.notifications.reminderEveryHours ? (
                  <p className="text-xs text-muted-foreground">
                    {t("newBinder.reminderEveryHours", {
                      count: binder.notifications.reminderEveryHours,
                    })}
                  </p>
                ) : null
              ) : null}
            </Section>
          )}

          {tab === "history" && (
            <Section title={t("history.title")}>
              <AuditTimeline events={binder.auditEvents ?? []} lang={i18n.language} t={t} />
            </Section>
          )}

          {(tab === "operations" || tab === "general") && (
            <Section title={t("detail.tabs.operations")}>
              <div className="space-y-4 py-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t("downloads.title")}
                  </h4>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {binder.status === "finished"
                      ? t("downloads.helpFinished")
                      : t("downloads.helpPending")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={onDownloadSigned}
                      disabled={binder.status !== "finished"}
                      className="gap-1.5"
                    >
                      <FileSignature className="h-4 w-4" />
                      {t("downloads.signedPdf")}
                    </Button>
                    <Button onClick={onDownloadCertificate} variant="outline" className="gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      {t("downloads.certificate")}
                    </Button>
                  </div>
                </div>
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

function InlineEditor({
  value,
  onChange,
  onCommit,
  onCancel,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-1.5">
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          rows={2}
          className="flex-1 text-sm"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancel();
          }}
          className="h-8 flex-1 text-sm"
        />
      )}
      <button
        onClick={onCommit}
        className="rounded-md border border-action/40 bg-action/10 p-1.5 text-action hover:bg-action/20"
        aria-label="Save"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="rounded-md border bg-background p-1.5 text-muted-foreground hover:bg-accent"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
  const startDrag = (event: React.PointerEvent, handle: Handle) => {
    event.stopPropagation();
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const parent =
      target.closest<HTMLElement>("[data-page-surface]") ??
      (target.offsetParent as HTMLElement | null);

    if (!parent) {
      return;
    }

    const rect = parent.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { x: field.x, y: field.y, w: field.width, h: field.height };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      let { x, y, w, h } = start;

      if (handle === "move") {
        x = Math.max(0, Math.min(1 - w, start.x + dx));
        y = Math.max(0, Math.min(1 - h, start.y + dy));
      } else {
        if (handle.includes("e")) {
          w = Math.max(MIN_W, Math.min(1 - start.x, start.w + dx));
        }
        if (handle.includes("s")) {
          h = Math.max(MIN_H, Math.min(1 - start.y, start.h + dy));
        }
        if (handle.includes("w")) {
          const nextWidth = Math.max(MIN_W, start.w - dx);
          x = Math.max(0, start.x + (start.w - nextWidth));
          w = nextWidth;
        }
        if (handle.includes("n")) {
          const nextHeight = Math.max(MIN_H, start.h - dy);
          y = Math.max(0, start.y + (start.h - nextHeight));
          h = nextHeight;
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
      onPointerDown={(event) => startDrag(event, "move")}
      onClick={(event) => event.stopPropagation()}
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
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="rounded p-0.5 hover:bg-white/40"
        aria-label="Remove"
      >
        <X className="h-2.5 w-2.5" />
      </button>
      {handles.map((handle) => (
        <span
          key={handle.key}
          onPointerDown={(event) => startDrag(event, handle.key)}
          className={cn(
            "absolute h-2 w-2 rounded-sm border bg-white opacity-0 transition group-hover:opacity-100",
            handle.cls,
          )}
          style={{ borderColor: color, touchAction: "none" }}
        />
      ))}
    </div>
  );
}

const AUDIT_ICONS: Record<AuditEventKind, React.ComponentType<{ className?: string }>> = {
  "binder.created": Plus,
  "binder.started": Play,
  "binder.completed": CheckCircle2,
  "binder.stopped": XCircle,
  "binder.archived": Lock,
  "signer.invited": Mail,
  "signer.viewed": Eye,
  "signer.signed": CheckCircle2,
  "signer.declined": XCircle,
  "signer.reminded": BellRing,
  "evidence.downloaded": Download,
};

const AUDIT_TONES: Record<AuditEventKind, string> = {
  "binder.created": "text-muted-foreground",
  "binder.started": "text-action",
  "binder.completed": "text-action",
  "binder.stopped": "text-destructive",
  "binder.archived": "text-muted-foreground",
  "signer.invited": "text-action",
  "signer.viewed": "text-muted-foreground",
  "signer.signed": "text-action",
  "signer.declined": "text-destructive",
  "signer.reminded": "text-action",
  "evidence.downloaded": "text-muted-foreground",
};

function AuditTimeline({
  events,
  lang,
  t,
}: {
  events: AuditEvent[];
  lang: string;
  t: (key: string) => string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <History className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      </div>
    );
  }
  // Newest events first.
  const sorted = events.slice().sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="relative space-y-3 pl-6">
      <span className="absolute left-2 top-2 bottom-2 w-px bg-border" aria-hidden />
      {sorted.map((ev) => {
        const Icon = AUDIT_ICONS[ev.kind] ?? History;
        const tone = AUDIT_TONES[ev.kind] ?? "text-foreground";
        return (
          <li key={ev.id} className="relative">
            <span
              className={`absolute -left-[18px] top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background ${tone}`}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={`text-sm font-medium ${tone}`}>
                  {t(`history.kinds.${ev.kind}` as never) || ev.kind}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(ev.at, lang)}</span>
              </div>
              {(ev.actorName || ev.actorEmail) && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {ev.actorName ?? ""}
                  {ev.actorEmail ? ` <${ev.actorEmail}>` : ""}
                  {ev.targetName || ev.targetEmail ? (
                    <>
                      {" → "}
                      {ev.targetName ?? ""}
                      {ev.targetEmail ? ` <${ev.targetEmail}>` : ""}
                    </>
                  ) : null}
                </div>
              )}
              {ev.message && <p className="mt-1 text-xs text-foreground/80">{ev.message}</p>}
              {ev.ip && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("history.ip")} : {ev.ip}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
