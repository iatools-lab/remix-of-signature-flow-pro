import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pen, Type, Image as ImageIcon, Trash2, Save, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth";
import {
  getMySignature,
  saveMySignature,
  clearMySignature,
  type SavedSignatureMethod,
} from "@/lib/mySignature";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-signature")({
  head: () => ({
    meta: [
      { title: "Ma signature — Usign" },
      {
        name: "description",
        content: "Enregistrez votre signature pour la réutiliser automatiquement.",
      },
    ],
  }),
  component: MySignaturePage,
});

const METHODS: {
  key: SavedSignatureMethod;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "drawn", icon: Pen },
  { key: "typed", icon: Type },
  { key: "image", icon: ImageIcon },
];

function MySignaturePage() {
  const { t, i18n } = useTranslation();
  const session = getSession();
  const email = session?.email ?? "";

  const [saved, setSaved] = useState(() => getMySignature(email));
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<SavedSignatureMethod>("drawn");

  // Drawn
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Typed
  const [typed, setTyped] = useState(session?.name ?? "");

  // Image
  const [imageData, setImageData] = useState<string | null>(null);

  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(getMySignature(email));
    window.addEventListener("usign:mySignature", sync);
    return () => window.removeEventListener("usign:mySignature", sync);
  }, [email]);

  useEffect(() => {
    if (!editing || method !== "drawn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    setHasDrawn(false);
  }, [editing, method]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };
  const endDraw = () => {
    drawingRef.current = false;
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
  };

  const canSave = (() => {
    if (method === "drawn") return hasDrawn;
    if (method === "typed") return typed.trim().length > 0;
    if (method === "image") return Boolean(imageData);
    return false;
  })();

  const handleSave = () => {
    if (!email) return;
    let data = "";
    if (method === "drawn") data = canvasRef.current?.toDataURL("image/png") ?? "";
    else if (method === "typed") data = typed.trim();
    else if (method === "image") data = imageData ?? "";
    saveMySignature(email, { method, data });
    setEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDelete = () => {
    if (!email) return;
    if (!confirm(t("mySignature.confirmDelete"))) return;
    clearMySignature(email);
  };

  const startEdit = () => {
    setEditing(true);
    if (saved) {
      setMethod(saved.method);
      if (saved.method === "typed") setTyped(saved.data);
      if (saved.method === "image") setImageData(saved.data);
    } else {
      setMethod("drawn");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t("mySignature.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("mySignature.subtitle")}</p>
        </div>

        {!editing && (
          <div className="rounded-lg border bg-card p-6">
            {saved ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {saved.method === "drawn"
                        ? t("mySignature.savedMethodDrawn")
                        : saved.method === "typed"
                          ? t("mySignature.savedMethodTyped")
                          : t("mySignature.savedMethodImage")}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {t("mySignature.savedOn", {
                        date: formatDateTime(saved.updatedAt, i18n.language),
                      })}
                    </div>
                  </div>
                  {justSaved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-action/10 px-2.5 py-1 text-xs font-medium text-action">
                      <Check className="h-3.5 w-3.5" /> {t("mySignature.savedToast")}
                    </span>
                  )}
                </div>

                <div className="flex min-h-32 items-center justify-center rounded border-2 border-dashed border-action/30 bg-white p-4">
                  {saved.method === "typed" ? (
                    <span
                      className="text-3xl text-slate-900"
                      style={{ fontFamily: '"Brush Script MT", "Snell Roundhand", cursive' }}
                    >
                      {saved.data}
                    </span>
                  ) : (
                    <img src={saved.data} alt="Signature" className="max-h-32 object-contain" />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={startEdit} className="bg-action text-action-foreground hover:opacity-90">
                    <Pen className="mr-2 h-4 w-4" /> {t("mySignature.edit")}
                  </Button>
                  <Button variant="outline" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" /> {t("mySignature.delete")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">{t("mySignature.empty")}</p>
                <Button onClick={startEdit} className="bg-action text-action-foreground hover:opacity-90">
                  <Pen className="mr-2 h-4 w-4" /> {t("mySignature.create")}
                </Button>
              </div>
            )}
          </div>
        )}

        {editing && (
          <div className="space-y-4 rounded-lg border bg-card p-6">
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs font-medium transition",
                      active
                        ? "border-action bg-action/10 text-action"
                        : "bg-card text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {t(`sign.method${m.key.charAt(0).toUpperCase() + m.key.slice(1)}` as never)}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border bg-background p-4">
              {method === "drawn" && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">{t("sign.drawHere")}</p>
                  <canvas
                    ref={canvasRef}
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    className="h-40 w-full touch-none rounded border-2 border-dashed border-action/40 bg-white"
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" /> {t("sign.clear")}
                  </button>
                </div>
              )}

              {method === "typed" && (
                <div className="space-y-2">
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={t("sign.typeName")}
                  />
                  <div className="rounded border bg-white p-4 text-center">
                    <span
                      className="text-3xl text-slate-900"
                      style={{ fontFamily: '"Brush Script MT", "Snell Roundhand", cursive' }}
                    >
                      {typed || "—"}
                    </span>
                  </div>
                </div>
              )}

              {method === "image" && (
                <div className="space-y-2">
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed border-action/40 bg-action/5 p-6 text-center text-sm text-action hover:bg-action/10">
                    <ImageIcon className="h-5 w-5" />
                    {t("sign.uploadImage")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {imageData && (
                    <div className="rounded border bg-white p-3">
                      <img src={imageData} alt="Signature" className="mx-auto h-24 object-contain" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t("mySignature.otpDisabled")}</p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="bg-action text-action-foreground hover:opacity-90"
              >
                <Save className="mr-2 h-4 w-4" /> {t("mySignature.save")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
          <Link to="/inbox" className="font-medium text-action hover:underline">
            {t("inbox.title")}
          </Link>{" "}
          — {t("inbox.subtitle")}
        </div>
      </div>
    </AppShell>
  );
}
