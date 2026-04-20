import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pen, Type, Image as ImageIcon, KeyRound, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SignatureMethod = "drawn" | "typed" | "image" | "otp";

export type SignatureResult = { method: SignatureMethod; data: string };

const METHODS: { key: SignatureMethod; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "drawn", icon: Pen },
  { key: "typed", icon: Type },
  { key: "image", icon: ImageIcon },
  { key: "otp", icon: KeyRound },
];

export function SignaturePad({
  signerName,
  onConfirm,
  onCancel,
}: {
  signerName: string;
  onConfirm: (r: SignatureResult) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<SignatureMethod>("drawn");

  // Drawn
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Typed
  const [typed, setTyped] = useState(signerName);

  // Image
  const [imageData, setImageData] = useState<string | null>(null);

  // OTP
  const [expectedOtp] = useState(() =>
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState(false);

  useEffect(() => {
    if (method !== "drawn") return;
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
  }, [method]);

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

  const canConfirm = (() => {
    if (method === "drawn") return hasDrawn;
    if (method === "typed") return typed.trim().length > 0;
    if (method === "image") return Boolean(imageData);
    if (method === "otp") return otpInput.length === 6;
    return false;
  })();

  const confirm = () => {
    if (method === "drawn") {
      const data = canvasRef.current?.toDataURL("image/png") ?? "";
      onConfirm({ method, data });
    } else if (method === "typed") {
      onConfirm({ method, data: typed.trim() });
    } else if (method === "image") {
      onConfirm({ method, data: imageData ?? "" });
    } else {
      if (otpInput !== expectedOtp) {
        setOtpError(true);
        return;
      }
      onConfirm({ method, data: `OTP:${otpInput}` });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("sign.chooseMethod")}</p>
      <div className="grid grid-cols-4 gap-2">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = method === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMethod(m.key);
                setOtpError(false);
              }}
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

      <div className="rounded-lg border bg-card p-4">
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

        {method === "otp" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("sign.otpHelp")}</p>
            <div className="rounded border bg-muted px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("sign.otpCode")}
              </div>
              <div className="font-mono text-2xl tracking-[0.5em] text-foreground">
                {expectedOtp}
              </div>
            </div>
            <Input
              value={otpInput}
              onChange={(e) => {
                setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                setOtpError(false);
              }}
              placeholder={t("sign.otpInput")}
              inputMode="numeric"
              className="text-center font-mono tracking-widest"
            />
            {otpError && (
              <p className="text-xs text-destructive">{t("sign.invalidOtp")}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("sign.cancel")}
        </Button>
        <Button
          onClick={confirm}
          disabled={!canConfirm}
          className="bg-action text-action-foreground hover:opacity-90"
        >
          {t("sign.confirm")}
        </Button>
      </div>
    </div>
  );
}
