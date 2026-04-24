import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Camera, Lock, Save, Trash2, User as UserIcon, BellRing } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_NOTIFS,
  getSession,
  updateSession,
  type NotificationPrefs,
  type Session,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — Usign" },
      {
        name: "description",
        content: "Gérez votre profil, mot de passe et préférences de notifications.",
      },
    ],
  }),
  component: SettingsPage,
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+0-9 .()\-/]*$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
});

function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setSession(getSession());
    sync();
    window.addEventListener("goodflag:auth", sync);
    return () => window.removeEventListener("goodflag:auth", sync);
  }, []);

  useEffect(() => {
    if (mounted && !session) navigate({ to: "/login" });
  }, [mounted, session, navigate]);

  if (!mounted || !session) {
    return (
      <AppShell>
        <div className="h-32 animate-pulse rounded-lg bg-muted/40" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("settings.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
        </header>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="h-4 w-4" />
              {t("settings.tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="h-4 w-4" />
              {t("settings.tabs.security")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <BellRing className="h-4 w-4" />
              {t("settings.tabs.notifications")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileForm session={session} onSaved={(s) => setSession(s)} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityForm />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsForm session={session} onSaved={(s) => setSession(s)} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ----------------------------- Profile ----------------------------- */

function ProfileForm({
  session,
  onSaved,
}: {
  session: Session;
  onSaved: (s: Session) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone ?? "");
  const [photo, setPhoto] = useState<string | undefined>(session.photo);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.profile.invalidImage"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.profile.tooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ name, phone });
    if (!parsed.success) {
      const errs: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof errors;
        errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    const updated = updateSession({
      name: parsed.data.name,
      phone: parsed.data.phone || undefined,
      photo,
    });
    if (updated) {
      onSaved(updated);
      toast.success(t("settings.profile.saved"));
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold text-foreground">
        {t("settings.profile.heading")}
      </h2>

      {/* Photo */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-brand text-xl font-semibold text-brand-foreground",
            )}
          >
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{session.initials}</span>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("settings.profile.photo")}
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-1.5 h-4 w-4" />
              {t("settings.profile.uploadPhoto")}
            </Button>
            {photo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPhoto(undefined)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t("settings.profile.removePhoto")}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("settings.profile.name")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("settings.profile.email")}</Label>
          <Input id="email" value={session.email} disabled readOnly />
          <p className="text-xs text-muted-foreground">{t("settings.profile.emailHelp")}</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="phone">{t("settings.profile.phone")}</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("settings.profile.phonePlaceholder")}
            maxLength={40}
            inputMode="tel"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="bg-action text-action-foreground hover:opacity-90">
          <Save className="mr-2 h-4 w-4" />
          {t("settings.profile.save")}
        </Button>
      </div>
    </form>
  );
}

/* ----------------------------- Security ----------------------------- */

function SecurityForm() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!current || !next || !confirm) {
      setError(t("settings.security.required"));
      return;
    }
    if (next.length < 8) {
      setError(t("settings.security.tooShort"));
      return;
    }
    if (next !== confirm) {
      setError(t("settings.security.mismatch"));
      return;
    }
    // Demo only — no real password store. We just toast success.
    setError(null);
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success(t("settings.security.updated"));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t("settings.security.heading")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.security.intro")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="current">{t("settings.security.current")}</Label>
        <Input
          id="current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new">{t("settings.security.new")}</Label>
          <Input
            id="new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t("settings.security.confirm")}</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" className="bg-action text-action-foreground hover:opacity-90">
          <Lock className="mr-2 h-4 w-4" />
          {t("settings.security.submit")}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------- Notifications --------------------------- */

function NotificationsForm({
  session,
  onSaved,
}: {
  session: Session;
  onSaved: (s: Session) => void;
}) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    ...DEFAULT_NOTIFS,
    ...(session.notifications ?? {}),
  });

  const set = <K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const updated = updateSession({ notifications: prefs });
    if (updated) {
      onSaved(updated);
      toast.success(t("settings.notifications.saved"));
    }
  };

  const rows: { key: keyof NotificationPrefs; label: string }[] = [
    { key: "emailOnSent", label: t("settings.notifications.emailOnSent") },
    { key: "emailOnSigned", label: t("settings.notifications.emailOnSigned") },
    { key: "emailOnDeclined", label: t("settings.notifications.emailOnDeclined") },
    { key: "reminders", label: t("settings.notifications.reminders") },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t("settings.notifications.heading")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("settings.notifications.intro")}
        </p>
      </div>

      <ul className="divide-y rounded-md border">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-foreground">{r.label}</span>
            <Switch
              checked={prefs[r.key]}
              onCheckedChange={(v) => set(r.key, Boolean(v))}
              aria-label={r.label}
            />
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <Button type="submit" className="bg-action text-action-foreground hover:opacity-90">
          <Save className="mr-2 h-4 w-4" />
          {t("settings.notifications.save")}
        </Button>
      </div>
    </form>
  );
}
