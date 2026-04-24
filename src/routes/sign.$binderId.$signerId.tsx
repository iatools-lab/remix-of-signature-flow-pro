import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Pen,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DocumentPagePreview } from "@/components/DocumentPagePreview";
import { SignaturePad, type SignatureResult } from "@/components/SignaturePad";
import { useBinders } from "@/lib/store";
import { getInitialsFromName, type SignatureField } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sign/$binderId/$signerId")({
  head: () => ({ meta: [{ title: "Signature — Usign" }] }),
  component: SignPage,
});

function SignPage() {
  const { binderId, signerId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { binders, signAs, markSignerViewed, declineAs } = useBinders();
  const navigate = useNavigate();
  const binder = binders.find((b) => b.id === binderId);
  const signer = binder?.signers?.find((s) => s.id === signerId);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineErr, setDeclineErr] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  // Log "viewed" once when the signer opens the page (only if pending).
  useEffect(() => {
    if (binder && signer && signer.status !== "signed" && !signer.viewedAt) {
      markSignerViewed(binder.id, signer.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder?.id, signer?.id]);

  const submitDecline = () => {
    if (!binder || !signer) return;
    const reason = declineReason.trim();
    if (reason.length < 3) {
      setDeclineErr(t("decline.error"));
      return;
    }
    declineAs(binder.id, signer.id, reason);
    setDeclined(true);
    setDeclineOpen(false);
  };

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [pendingSignatures, setPendingSignatures] = useState<Record<string, SignatureResult>>(
    {},
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (binder?.documents?.[0] && !activeDocId) {
      setActiveDocId(binder.documents[0].id);
    }
  }, [binder, activeDocId]);

  const myFields: SignatureField[] = useMemo(
    () => binder?.signatureFields?.filter((f) => f.signerId === signerId) ?? [],
    [binder, signerId],
  );

  const totalToSign = myFields.length;
  const signedCount = Object.keys(pendingSignatures).length;
  const allFilled = totalToSign > 0 && signedCount === totalToSign;

  const toggleLang = () => {
    const next = i18n.language === "fr" ? "en" : "fr";
    i18n.changeLanguage(next);
    if (typeof window !== "undefined") localStorage.setItem("usign.lang", next);
  };

  if (!binder || !signer) {
    return (
      <PublicShell onToggleLang={toggleLang}>
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("sign.notFound")}</p>
        </div>
      </PublicShell>
    );
  }

  if (signer.status === "signed" && !done) {
    return (
      <PublicShell onToggleLang={toggleLang}>
        <Card>
          <CheckCircle2 className="mx-auto h-12 w-12 text-action" />
          <h2 className="mt-3 text-xl font-semibold text-foreground">
            {t("sign.alreadySigned")}
          </h2>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-action hover:underline"
          >
            {t("sign.backHome")}
          </Link>
        </Card>
      </PublicShell>
    );
  }

  if (done) {
    return (
      <PublicShell onToggleLang={toggleLang}>
        <Card>
          <CheckCircle2 className="mx-auto h-14 w-14 text-action" />
          <h2 className="mt-3 text-2xl font-semibold text-foreground">{t("sign.thanks")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{binder.name}</p>
          <Button
            onClick={() => navigate({ to: "/" })}
            className="mt-5 bg-action text-action-foreground hover:opacity-90"
          >
            {t("sign.backHome")}
          </Button>
        </Card>
      </PublicShell>
    );
  }

  if (declined || signer.status === "declined") {
    return (
      <PublicShell onToggleLang={toggleLang}>
        <Card>
          <XCircle className="mx-auto h-14 w-14 text-destructive" />
          <h2 className="mt-3 text-2xl font-semibold text-foreground">{t("decline.success")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{binder.name}</p>
          <Button
            onClick={() => navigate({ to: "/" })}
            variant="outline"
            className="mt-5"
          >
            {t("sign.backHome")}
          </Button>
        </Card>
      </PublicShell>
    );
  }

  const activeDoc = binder.documents?.find((d) => d.id === activeDocId);
  const activeField = myFields.find((f) => f.id === activeFieldId);
  const fieldsOnPage = (binder.signatureFields ?? []).filter(
    (f) => f.documentId === activeDocId && f.page === activePage,
  );

  const finalize = () => {
    // Use the most recent applied "signature" entry as canonical, but pass
    // per-field overrides so that "initial" zones keep their initials text.
    const entries = Object.entries(pendingSignatures);
    if (entries.length === 0) return;
    // Prefer a non-initial entry as canonical (full signature), else fallback.
    const sigEntries = entries.filter(([fid]) => {
      const fld = myFields.find((f) => f.id === fid);
      return fld?.kind !== "initial";
    });
    const canonical = (sigEntries[sigEntries.length - 1] ?? entries[entries.length - 1])[1];
    const fieldOverrides: Record<
      string,
      { method: SignatureResult["method"]; signatureData: string }
    > = {};
    for (const [fid, res] of entries) {
      fieldOverrides[fid] = { method: res.method, signatureData: res.data };
    }
    signAs(binder.id, signer.id, {
      method: canonical.method,
      signatureData: canonical.data,
      fieldOverrides,
    });
    setDone(true);
  };

  return (
    <PublicShell onToggleLang={toggleLang}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Document area */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("sign.documentsToSign")}
                </div>
                <h2 className="text-lg font-semibold text-foreground">{binder.name}</h2>
                {binder.description && (
                  <p className="text-xs text-muted-foreground">{binder.description}</p>
                )}
              </div>
            </div>

            {/* Doc tabs */}
            <div className="flex flex-wrap gap-2 border-b pb-2">
              {(binder.documents ?? []).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setActiveDocId(d.id);
                    setActivePage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    activeDocId === d.id
                      ? "bg-action/15 text-action"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {d.name}
                </button>
              ))}
            </div>

            {activeDoc ? (
              <>
                <div className="my-3 flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    disabled={activePage <= 1}
                    className="flex items-center gap-1 rounded p-1 disabled:opacity-40 hover:bg-accent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    Page {activePage} / {activeDoc.pages ?? 1}
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

                <div className="mx-auto max-w-md">
                  <DocumentPagePreview
                    documentName={activeDoc.name}
                    page={activePage}
                    totalPages={activeDoc.pages ?? 1}
                  >
                    {fieldsOnPage.map((f) => {
                      const isMine = f.signerId === signerId;
                      const filled = Boolean(pendingSignatures[f.id] || f.signatureData);
                      const fSigner = binder.signers?.find((s) => s.id === f.signerId);
                      const color = fSigner?.color ?? "#0EA5E9";
                      const isInitial = f.kind === "initial";
                      const initialsText = getInitialsFromName(fSigner?.name ?? "");
                      const onZoneClick = () => {
                        if (!isMine || filled) return;
                        if (isInitial) {
                          // Auto-fill the initial (paraphe) zone with the signer's initials.
                          setPendingSignatures((prev) => ({
                            ...prev,
                            [f.id]: { method: "typed", data: initialsText },
                          }));
                        } else {
                          setActiveFieldId(f.id);
                        }
                      };
                      const filledMethod = pendingSignatures[f.id]?.method;
                      const filledData = pendingSignatures[f.id]?.data;
                      return (
                        <button
                          key={f.id}
                          onClick={onZoneClick}
                          disabled={!isMine || filled}
                          className={cn(
                            "absolute flex items-center justify-center overflow-hidden rounded border-2 text-[10px] font-semibold uppercase shadow-sm transition",
                            isMine && !filled && "cursor-pointer animate-pulse",
                            !isMine && "cursor-not-allowed opacity-60",
                          )}
                          style={{
                            left: `${f.x * 100}%`,
                            top: `${f.y * 100}%`,
                            width: `${f.width * 100}%`,
                            height: `${f.height * 100}%`,
                            borderColor: color,
                            backgroundColor: filled ? "white" : `${color}25`,
                            color,
                          }}
                        >
                          {filled ? (
                            isInitial ? (
                              <span
                                className="font-bold tracking-widest text-slate-900"
                                style={{ fontSize: "14px" }}
                              >
                                {filledData}
                              </span>
                            ) : filledMethod === "drawn" || filledMethod === "image" ? (
                              <img
                                src={filledData}
                                alt=""
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <span
                                className="truncate px-1 normal-case text-slate-900"
                                style={{
                                  fontFamily:
                                    filledMethod === "typed"
                                      ? '"Brush Script MT", "Snell Roundhand", cursive'
                                      : undefined,
                                  fontSize: "13px",
                                }}
                              >
                                {filledData}
                              </span>
                            )
                          ) : (
                            <span className="flex items-center gap-1">
                              <Pen className="h-2.5 w-2.5" />
                              {isMine
                                ? isInitial
                                  ? t("sign.initialZoneLabel")
                                  : t("sign.zoneLabel")
                                : fSigner?.name?.split(" ")[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </DocumentPagePreview>
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("newBinder.noDocuments")}
              </p>
            )}
          </div>

          {/* Attachments */}
          {(binder.attachments?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t("sign.attachments")}
              </h3>
              <ul className="space-y-1.5">
                {binder.attachments?.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{a.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sign.welcome", { name: signer.name })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{signer.email}</p>
            <p className="mt-3 text-sm text-foreground">{t("sign.intro")}</p>

            <div className="mt-4 rounded-md border bg-muted/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("sign.progress", { done: signedCount, total: totalToSign })}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-action transition-all"
                  style={{
                    width: `${totalToSign === 0 ? 0 : (signedCount / totalToSign) * 100}%`,
                  }}
                />
              </div>
            </div>

            {totalToSign > 0 && (
              <ul className="mt-4 space-y-1.5">
                {myFields.map((f, i) => {
                  const filled = Boolean(pendingSignatures[f.id]);
                  const doc = binder.documents?.find((d) => d.id === f.documentId);
                  return (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded border bg-background px-2.5 py-1.5 text-xs"
                    >
                      <button
                        onClick={() => {
                          setActiveDocId(f.documentId);
                          setActivePage(f.page);
                        }}
                        className="flex flex-1 items-start gap-1.5 text-left"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                            filled
                              ? "bg-action text-action-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {filled ? "✓" : i + 1}
                        </span>
                        <span className="text-foreground">
                          {f.kind === "initial"
                            ? t("sign.initialOf", {
                                n: i + 1,
                                p: f.page,
                                doc: doc?.name ?? "—",
                              })
                            : t("sign.zoneOf", {
                                n: i + 1,
                                p: f.page,
                                doc: doc?.name ?? "—",
                              })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Button
              onClick={finalize}
              disabled={!allFilled}
              className="mt-4 w-full bg-action text-action-foreground hover:opacity-90"
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> {t("sign.finalize")}
            </Button>

            <Button
              onClick={() => {
                setDeclineErr(null);
                setDeclineReason("");
                setDeclineOpen(true);
              }}
              variant="outline"
              className="mt-2 w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" /> {t("decline.button")}
            </Button>

            {totalToSign === 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("sign.allSigned")}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Signature pad dialog */}
      <Dialog
        open={Boolean(activeField)}
        onOpenChange={(v) => !v && setActiveFieldId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("sign.title")}</DialogTitle>
          </DialogHeader>
          {activeField && (
            <SignaturePad
              signerName={signer.name}
              onCancel={() => setActiveFieldId(null)}
              onConfirm={(r) => {
                setPendingSignatures((prev) => ({ ...prev, [activeField.id]: r }));
                setActiveFieldId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}

function PublicShell({
  children,
  onToggleLang,
}: {
  children: React.ReactNode;
  onToggleLang: () => void;
}) {
  const { i18n } = useTranslation();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <Logo />
        <button
          onClick={onToggleLang}
          className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold uppercase text-foreground hover:bg-accent"
        >
          {i18n.language}
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
      {children}
    </div>
  );
}
