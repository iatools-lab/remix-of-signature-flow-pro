import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { getSession, login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Usign" },
      { name: "description", content: "Connectez-vous à votre espace Usign de signature électronique." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (getSession()) navigate({ to: "/" });
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    login(email.trim());
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
            La signature électronique<br />sécurisée pour vos équipes.
          </h2>
          <p className="max-w-md text-sidebar-foreground/70">
            Centralisez vos parapheurs, suivez l'avancement des signatures et archivez vos
            documents en toute sérénité avec Usign.
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
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-action text-action-foreground hover:opacity-90">
              {t("auth.submit")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("auth.demo")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
