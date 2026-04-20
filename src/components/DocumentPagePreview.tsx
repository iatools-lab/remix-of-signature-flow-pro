import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mock paper preview for a document page. We render a simple A4-ratio card
 * with faux text lines, so users can place signature zones on it.
 */
export function DocumentPagePreview({
  documentName,
  page,
  totalPages,
  className,
  children,
  onClick,
}: {
  documentName: string;
  page: number;
  totalPages: number;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  // Generate deterministic faux content based on doc name + page
  const seed = `${documentName}-${page}`.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lines = Array.from({ length: 18 }, (_, i) => {
    const w = 40 + ((seed + i * 7) % 55);
    return w;
  });

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        onClick={onClick}
        className={cn(
          "relative aspect-[1/1.414] w-full overflow-hidden rounded border bg-white shadow-sm",
          onClick && "cursor-crosshair",
        )}
      >
        {/* Header band */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          <FileText className="h-3 w-3" />
          <span className="truncate">{documentName}</span>
        </div>
        {/* Faux text */}
        <div className="absolute inset-x-6 top-12 space-y-2">
          <div className="h-3 w-1/2 rounded bg-slate-300" />
          <div className="h-2 w-1/3 rounded bg-slate-200" />
        </div>
        <div className="absolute inset-x-6 top-24 space-y-1.5">
          {lines.map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-sm bg-slate-200"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        {/* Page footer */}
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-[9px] text-slate-400">
          Page {page} / {totalPages}
        </div>
        {children}
      </div>
    </div>
  );
}
