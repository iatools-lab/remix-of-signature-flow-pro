import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContacts } from "@/lib/store";

export function NewContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { create } = useContacts();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
    });
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompany("");
    onOpenChange(false);
  };

  const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
      <label className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && "*"}
      </label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-center justify-between space-y-0 bg-sidebar px-6 py-4 text-sidebar-foreground [&>button]:hidden">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <UserPlus className="h-5 w-5" />
            {t("contacts.new")}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="space-y-4 px-8 py-6">
            <Field label={t("contacts.cols.name")} required>
              <div className="flex gap-2">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" required />
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" required />
              </div>
            </Field>
            <Field label={t("contacts.cols.email")} required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label={t("contacts.cols.phone")}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label={t("contacts.cols.company")}>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-3 bg-muted/50 px-8 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-action hover:text-action">
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="bg-[oklch(0.7_0.16_240)] text-white hover:bg-[oklch(0.65_0.18_240)]">
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
