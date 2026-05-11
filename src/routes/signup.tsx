import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { getSession, loginWithGoogle, signup } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";

const searchSchema = z.object({
  redirect: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Créer un compte — Usign" },
      {
        name: "description",
        content:
          "Créez votre compte Usign en quelques secondes pour signer vos documents en ligne.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { redirect, email: searchEmail } = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => searchEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectAfterAuth = useCallback(() => {
    if (typeof window !== "undefined" && redirect?.startsWith("/")) {
      window.location.assign(redirect);
      return;
    }

    navigate({ to: "/" });
  }, [navigate, redirect]);

  useEffect(() => {
    if (getSession()) {
      redirectAfterAuth();
    }
  }, [redirectAfterAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6 || isSubmitting) return;
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password, confirmPassword);
      redirectAfterAuth();
    } catch (error) {
      toast.error(getErrorMessage(error, "Création du compte impossible"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
        await loginWithGoogle(credential);
        redirectAfterAuth();
      } catch (error) {
        toast.error(getErrorMessage(error, "Inscription Google impossible"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, redirectAfterAuth],
  );

  const toggleLang = () => {
    const next = i18n.language === "fr" ? "en" : "fr";
    i18n.changeLanguage(next);
    localStorage.setItem("usign.lang", next);
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Logo />
        <div className="space-y-4">
          <h2 className="text-4xl font-semibold leading-tight">
            Rejoignez Usign
            <br />
            en quelques secondes.
          </h2>
          <p className="max-w-md text-sidebar-foreground/70">
            Créez votre compte pour préparer vos parapheurs, inviter vos signataires et suivre vos
            signatures en temps réel.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/60">© Usign</div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-end p-4">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">{i18n.language}</span>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">{t("auth.signupTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.signupSubtitle")}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.name")}
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  maxLength={80}
                  disabled={isSubmitting}
                  placeholder={t("auth.namePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.email")}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  disabled={isSubmitting}
                  placeholder="vous@entreprise.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.password")}
                </label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                  placeholder={t("auth.passwordPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.confirmPassword")}
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isSubmitting}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-action text-action-foreground hover:opacity-90"
            >
              {t("auth.signupSubmit")}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>{t("common.or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <GoogleAuthButton
              mode="signup"
              disabled={isSubmitting}
              locale={i18n.language}
              onCredential={handleGoogleCredential}
            />
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link
                to="/login"
                search={{ redirect, email: email.trim() || undefined }}
                className="font-medium text-action hover:underline"
              >
                {t("auth.loginLink")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
