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
import { getSession, login, loginWithGoogle } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";

const searchSchema = z.object({
  redirect: z.string().optional(),
  email: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Connexion — Usign" },
      {
        name: "description",
        content: "Connectez-vous à votre espace Usign de signature électronique.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { redirect, email: searchEmail } = Route.useSearch();
  const [email, setEmail] = useState(() => searchEmail ?? "");
  const [password, setPassword] = useState("");
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
    if (!email.trim() || !password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      redirectAfterAuth();
    } catch (error) {
      toast.error(getErrorMessage(error, "Connexion impossible"));
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
        toast.error(getErrorMessage(error, "Connexion Google impossible"));
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
            La signature électronique
            <br />
            sécurisée pour vos équipes.
          </h2>
          <p className="max-w-md text-sidebar-foreground/70">
            Centralisez vos parapheurs, suivez l'avancement des signatures et archivez vos documents
            en toute sérénité avec Usign.
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
              <h1 className="text-2xl font-semibold text-foreground">{t("auth.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.email")}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
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
                  disabled={isSubmitting}
                  placeholder="••••••••"
                />
              </div>
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-action hover:underline"
                >
                  {t("auth.forgotPasswordLink")}
                </Link>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-action text-action-foreground hover:opacity-90"
            >
              {t("auth.submit")}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>{t("common.or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <GoogleAuthButton
              mode="login"
              disabled={isSubmitting}
              locale={i18n.language}
              onCredential={handleGoogleCredential}
            />
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link
                to="/signup"
                search={{ redirect, email: email.trim() || undefined }}
                className="font-medium text-action hover:underline"
              >
                {t("auth.signupLink")}
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">{t("auth.demo")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
