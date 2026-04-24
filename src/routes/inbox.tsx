import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Inbox as InboxIcon, Pen, Zap, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useBinders } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { getMySignature, type SavedSignature } from "@/lib/mySignature";
import { formatDateTime } from "@/lib/format";
import { getInitialsFromName, type Binder, type BinderSigner } from "@/lib/mockData";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Attente de signature — Usign" },
      {
        name: "description",
        content: "Liste des parapheurs en attente de votre signature.",
      },
    ],
  }),
  component: InboxPage,
});

type InboxItem = {
  binder: Binder;
  signer: BinderSigner;
  zonesCount: number;
};

function InboxPage() {
  const { t, i18n } = useTranslation();
  const { binders, signAs } = useBinders();
  const navigate = useNavigate();
  const session = getSession();
  const email = session?.email ?? "";

  const [saved, setSaved] = useState<SavedSignature | null>(() => getMySignature(email));

  useEffect(() => {
    const sync = () => setSaved(getMySignature(email));
    window.addEventListener("usign:mySignature", sync);
    return () => window.removeEventListener("usign:mySignature", sync);
  }, [email]);

  const items: InboxItem[] = useMemo(() => {
    if (!email) return [];
    const out: InboxItem[] = [];
    for (const b of binders) {
      if (b.status !== "started") continue;
      const signer = (b.signers ?? []).find(
        (s) => s.email.toLowerCase() === email.toLowerCase() && s.status !== "signed",
      );
      if (!signer) continue;
      const zonesCount = (b.signatureFields ?? []).filter((f) => f.signerId === signer.id).length;
      out.push({ binder: b, signer, zonesCount });
    }
    // Sort by most recent update first
    return out.sort((a, b) => b.binder.updatedAt.localeCompare(a.binder.updatedAt));
  }, [binders, email]);

  const fmt = (iso: string) => formatDateTime(iso, i18n.language);

  const signOne = (item: InboxItem) => {
    if (!saved) return;
    const initials = getInitialsFromName(item.signer.name);
    // Build per-field overrides so that "initial" zones get the signer's
    // initials text, while regular signature zones use the saved signature.
    const fieldOverrides: Record<
      string,
      { method: "drawn" | "typed" | "image" | "otp"; signatureData: string }
    > = {};
    for (const f of item.binder.signatureFields ?? []) {
      if (f.signerId !== item.signer.id) continue;
      if (f.kind === "initial") {
        fieldOverrides[f.id] = { method: "typed", signatureData: initials };
      } else {
        fieldOverrides[f.id] = { method: saved.method, signatureData: saved.data };
      }
    }
    signAs(item.binder.id, item.signer.id, {
      method: saved.method,
      signatureData: saved.data,
      fieldOverrides,
    });
  };

  const openManual = (item: InboxItem) => {
    navigate({
      to: "/sign/$binderId/$signerId",
      params: { binderId: item.binder.id, signerId: item.signer.id },
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("inbox.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("inbox.subtitle")}</p>
          </div>
        </div>

        {/* Saved signature banner */}
        {saved ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-action/30 bg-action/5 p-3">
            <div className="flex items-center gap-2 text-action">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">{t("inbox.useSaved")}</span>
            </div>
            <span className="text-xs text-muted-foreground">{t("inbox.useSavedHint")}</span>
            <div className="ml-auto flex h-10 items-center rounded border bg-white px-3">
              {saved.method === "typed" ? (
                <span
                  className="text-lg text-slate-900"
                  style={{ fontFamily: '"Brush Script MT", "Snell Roundhand", cursive' }}
                >
                  {saved.data}
                </span>
              ) : (
                <img src={saved.data} alt="Signature" className="h-8 object-contain" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("inbox.noSavedSignature")}</span>
            <Link
              to="/my-signature"
              className="ml-auto text-sm font-medium text-action hover:underline"
            >
              {t("inbox.goToMySignature")} →
            </Link>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center">
            <InboxIcon className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t("inbox.empty")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">{t("inbox.cols.binder")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("inbox.cols.owner")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("inbox.cols.received")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("inbox.cols.zones")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.binder.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        to="/binders/detail/$id"
                        params={{ id: it.binder.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {it.binder.name}
                      </Link>
                      {it.binder.description && (
                        <div className="text-xs text-muted-foreground">
                          {it.binder.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
                          {it.binder.ownerInitials}
                        </span>
                        <div className="leading-tight">
                          <div className="text-xs font-medium text-foreground">
                            {it.binder.ownerName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {it.binder.ownerEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmt(it.binder.startedAt ?? it.binder.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {t("inbox.zonesCount", { count: it.zonesCount })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {saved && it.zonesCount > 0 && (
                          <Button
                            size="sm"
                            onClick={() => signOne(it)}
                            className="bg-action text-action-foreground hover:opacity-90"
                          >
                            <Zap className="mr-1.5 h-3.5 w-3.5" />
                            {t("inbox.applyAll")}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openManual(it)}>
                          <Pen className="mr-1.5 h-3.5 w-3.5" />
                          {t("inbox.sign")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
