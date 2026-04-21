import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, FileText, FilePlus2, Users, LogOut, Settings, Menu, Globe, Inbox, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { getSession, logout, type Session } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const sync = () => setSession(getSession());
    sync();
    window.addEventListener("usign:auth", sync);
    window.addEventListener("goodflag:auth", sync);
    return () => {
      window.removeEventListener("usign:auth", sync);
      window.removeEventListener("goodflag:auth", sync);
    };
  }, []);

  useEffect(() => {
    if (session === null && typeof window !== "undefined") {
      const id = setTimeout(() => {
        if (!getSession()) navigate({ to: "/login" });
      }, 0);
      return () => clearTimeout(id);
    }
  }, [session, navigate]);

  const path = location.pathname;
  const isHome = path === "/";
  const isBinders = path.startsWith("/binders");
  const isInbox = path.startsWith("/inbox");
  const isDocs = path.startsWith("/documents");
  const isContacts = path.startsWith("/contacts");
  const isMySig = path.startsWith("/my-signature");

  const toggleLang = () => {
    const next = i18n.language === "fr" ? "en" : "fr";
    i18n.changeLanguage(next);
    localStorage.setItem("usign.lang", next);
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          open ? "w-64" : "w-0 overflow-hidden",
        )}
      >
        <div className="flex h-16 items-center px-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          <NavItem to="/" icon={Home} label={t("nav.home")} active={isHome} />
          <NavItem to="/binders/all" icon={FilePlus2} label={t("nav.binders")} active={isBinders} />
          <NavItem to="/inbox" icon={Inbox} label={t("nav.inbox")} active={isInbox} />
          <NavItem to="/documents" icon={FileText} label={t("nav.documents")} active={isDocs} />
          <NavItem to="/contacts" icon={Users} label={t("nav.contacts")} active={isContacts} />
          <NavItem to="/my-signature" icon={PenLine} label={t("nav.mySignature")} active={isMySig} />
        </nav>
        <div className="px-4 py-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
          © Usign
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Toggle sidebar">
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {isHome
                ? t("home.greeting", { name: session?.name ?? "" })
                : isBinders
                  ? t("binders.title")
                  : isInbox
                    ? t("inbox.title")
                    : isDocs
                      ? t("documents.title")
                      : isContacts
                        ? t("contacts.title")
                        : isMySig
                          ? t("mySignature.title")
                          : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">{i18n.language}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground hover:opacity-90"
                  aria-label="User menu"
                >
                  {session?.initials ?? "··"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs">
                  <div className="font-medium text-foreground">{session?.name}</div>
                  <div className="text-muted-foreground">{session?.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  {t("common.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
