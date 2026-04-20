import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BinderStatus } from "@/lib/mockData";

const STATUS_LABEL: Record<BinderStatus, string> = {
  draft: "status.draft",
  started: "status.started",
  finished: "status.finished",
  stopped: "status.stopped",
  archived: "status.archived",
};

export function StatusBadge({ status }: { status: BinderStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white",
      )}
      style={{ backgroundColor: `var(--status-${status})` }}
    >
      {t(STATUS_LABEL[status]).replace(/s$/, "")}
    </span>
  );
}
