import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FilePlus2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBinders } from "@/lib/store";
import { getSession } from "@/lib/auth";

export function NewBinderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { create } = useBinders();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const session = getSession();
    const b = create({
      name: name.trim(),
      description: description.trim() || undefined,
      ownerName: session?.name ?? "User",
      ownerEmail: session?.email ?? "user@example.com",
      ownerInitials: session?.initials ?? "US",
    });
    setName("");
    setDescription("");
    onOpenChange(false);
    onCreated?.(b.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-center justify-between space-y-0 bg-sidebar px-6 py-4 text-sidebar-foreground [&>button]:hidden">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <FilePlus2 className="h-5 w-5" />
            {t("newBinder.title")}
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
          <div className="px-8 pb-2 pt-6">
            <h3 className="border-b pb-2 text-xl font-semibold text-foreground">
              {t("newBinder.general")}
            </h3>
          </div>
          <div className="space-y-4 px-8 py-6">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <label className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("newBinder.name")} *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                className="border-action/40 focus-visible:ring-action"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <label className="pt-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("newBinder.description")}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 bg-muted/50 px-8 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-action hover:text-action"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="bg-[oklch(0.7_0.16_240)] text-white hover:bg-[oklch(0.65_0.18_240)]"
            >
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
