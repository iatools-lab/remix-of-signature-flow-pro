import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { getSession, signup } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Créer un compte — Usign" },
      { name: "description", content: "Créez votre compte Usign en quelques secondes pour signer vos documents en ligne." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (getSession()) navigate({ to: "/" });
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) return;
    signup(name.trim(), email.trim());
    navigate({ to: "/" });
  };

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
            Rejoignez Usign<br />en quelques secondes.
          </h2>
          <p className="max-w-md text-sidebar-foreground/70">
            Créez votre compte pour préparer vos parapheurs, inviter vos signataires et
            suivre vos signatures en temps réel.
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
                  placeholder="vous@entreprise.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auth.password")}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="6 caractères minimum"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-action text-action-foreground hover:opacity-90">
              {t("auth.signupSubmit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link to="/login" className="font-medium text-action hover:underline">
                {t("auth.loginLink")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
