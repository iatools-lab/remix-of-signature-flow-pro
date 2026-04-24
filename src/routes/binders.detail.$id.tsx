import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
import { StatusBadge } from "@/components/StatusBadge";
import { useBinders } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { generateSignedPdf, generateCertificatePdf } from "@/lib/evidence";
import { getSession } from "@/lib/auth";
import {
  SIGNER_COLORS,
  type AuditEvent,
  type AuditEventKind,
  type BinderDocument,
  type BinderAttachment,
  type BinderSigner,
} from "@/lib/mockData";

export const Route = createFileRoute("/binders/detail/$id")({
  head: () => ({ meta: [{ title: "Détail parapheur — Usign" }] }),
  component: BinderDetail,
});

type Tab = "general" | "steps" | "documents" | "history" | "notifications" | "operations";

function BinderDetail() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { binders, update, startBinder: startBinderAction, recordDownload } = useBinders();
  const navigate = useNavigate();
  const binder = binders.find((b) => b.id === id);
  const [tab, setTab] = useState<Tab>("general");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<null | "name" | "description" | "group">(null);
  const [draftValue, setDraftValue] = useState("");
  const docInputRef = useRef<HTMLInputElement>(null);
  const attInputRef = useRef<HTMLInputElement>(null);

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

  const editable = binder.status === "draft";

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

  const toggleConsolidation = () => {
    if (!editable) return;
    update(binder.id, { consolidation: !binder.consolidation });
  };

  const toggleNotif = (key: "onStart" | "onComplete" | "reminders") => {
    if (!editable) return;
    const current = binder.notifications ?? { onStart: true, onComplete: true, reminders: false };
    update(binder.id, { notifications: { ...current, [key]: !current[key] } });
  };

  const removeSigner = (signerId: string) => {
    if (!editable) return;
    if (!window.confirm(t("detail.confirmRemoveSigner"))) return;
    const signers = (binder.signers ?? []).filter((s) => s.id !== signerId);
    const signatureFields = (binder.signatureFields ?? []).filter((f) => f.signerId !== signerId);
    update(binder.id, { signers, signatureFields });
  };

  const addSignerRow = () => {
    if (!editable) return;
    const list = binder.signers ?? [];
    const order = list.length + 1;
    const color = SIGNER_COLORS[list.length % SIGNER_COLORS.length];
    const newSigner: BinderSigner = {
      id: `s_${Date.now()}`,
      order,
      name: "Nouveau signataire",
      email: "",
      color,
      status: "pending",
    };
    update(binder.id, { signers: [...list, newSigner] });
  };

  const updateSignerField = (signerId: string, patch: Partial<BinderSigner>) => {
    if (!editable) return;
    const signers = (binder.signers ?? []).map((s) => (s.id === signerId ? { ...s, ...patch } : s));
    update(binder.id, { signers });
  };

  const removeDocument = (docId: string) => {
    if (!editable) return;
    if (!window.confirm(t("detail.confirmRemoveDocument"))) return;
    const documents = (binder.documents ?? []).filter((d) => d.id !== docId);
    const signatureFields = (binder.signatureFields ?? []).filter((f) => f.documentId !== docId);
    update(binder.id, { documents, signatureFields });
  };

  const onPickDocs = (files: FileList | null) => {
    if (!files || !editable) return;
    const next: BinderDocument[] = Array.from(files).map((f, i) => ({
      id: `d_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
      pages: 1 + ((f.size ?? 1000) % 3),
    }));
    update(binder.id, { documents: [...(binder.documents ?? []), ...next] });
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
    const session = getSession();
    generateSignedPdf(binder, i18n.language);
    recordDownload(binder.id, { name: session?.name, email: session?.email }, "signed_pdf");
  };
  const onDownloadCertificate = () => {
    const session = getSession();
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
                    const zoneCount = (binder.signatureFields ?? []).filter(
                      (f) => f.signerId === s.id,
                    ).length;
                    const signed = s.status === "signed";
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
                            <div className="text-xs text-muted-foreground">{s.email}</div>
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
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyLink(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === s.id ? t("common.copied") : t("detail.copyLink")}
                          </button>
                          <Link
                            to="/sign/$binderId/$signerId"
                            params={{ binderId: binder.id, signerId: s.id }}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-md bg-action px-2.5 py-1.5 text-xs font-medium text-action-foreground hover:opacity-90"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> {t("detail.openLink")}
                          </Link>
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
                <button
                  onClick={addSignerRow}
                  className="mx-auto mt-4 flex items-center gap-2 py-3 text-action hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">{t("detail.addSigner")}</span>
                </button>
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
                    const zones = (binder.signatureFields ?? []).filter(
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
                    <Button
                      onClick={onDownloadCertificate}
                      variant="outline"
                      className="gap-1.5"
                    >
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
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(ev.at, lang)}
                </span>
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
              {ev.message && (
                <p className="mt-1 text-xs text-foreground/80">{ev.message}</p>
              )}
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
