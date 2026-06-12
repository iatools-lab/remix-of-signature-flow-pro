import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// pdfjs-dist relies on browser-only globals like DOMMatrix, so it must only
// load in the browser. Importing it at module top-level breaks SSR.
type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("pdfjs unavailable on the server"));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, workerUrlMod] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/**
 * Mock paper preview for a document page. We render a simple A4-ratio card
 * with faux text lines, so users can place signature zones on it.
 */
export function DocumentPagePreview({
  documentName,
  page,
  totalPages,
  documentFile,
  className,
  children,
  onClick,
  onTotalPagesChange,
}: {
  documentName: string;
  page: number;
  totalPages: number;
  documentFile?: File;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTotalPagesChange?: (pages: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const onTotalPagesChangeRef = useRef(onTotalPagesChange);
  const [isPdfRendered, setIsPdfRendered] = useState(false);
  const hasPdfSource = Boolean(documentFile && documentFile.name.toLowerCase().endsWith(".pdf"));

  useEffect(() => {
    onTotalPagesChangeRef.current = onTotalPagesChange;
  }, [onTotalPagesChange]);

  useEffect(() => {
    let isCancelled = false;

    const renderPdf = async () => {
      if (!hasPdfSource || !documentFile) {
        setIsPdfRendered(false);
        return;
      }

      try {
        const { getDocument } = await loadPdfjs();
        const data = new Uint8Array(await documentFile.arrayBuffer());
        const loadingTask = getDocument({ data });
        const pdf = await loadingTask.promise;

        if (isCancelled) {
          await loadingTask.destroy();
          return;
        }

        onTotalPagesChangeRef.current?.(pdf.numPages);

        const safePage = Math.min(Math.max(page, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(safePage);
        const canvas = canvasRef.current;
        const surface = surfaceRef.current;

        if (!canvas || !surface) {
          await pdf.destroy();
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = surface.clientWidth || 600;
        const scale = availableWidth / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");

        if (!context) {
          await pdf.destroy();
          return;
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        // Provide both canvas and canvasContext to satisfy different pdfjs typings
        // and ensure the prepared context/transform is used for rendering.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - pdfjs render param typing may vary between versions
        await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
        await pdf.destroy();

        if (!isCancelled) {
          setIsPdfRendered(true);
        }
      } catch {
        if (!isCancelled) {
          setIsPdfRendered(false);
        }
      }
    };

    void renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [documentFile, hasPdfSource, page]);

  // Generate deterministic faux content based on doc name + page
  const seed = `${documentName}-${page}`.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lines = Array.from({ length: 18 }, (_, i) => {
    const w = 40 + ((seed + i * 7) % 55);
    return w;
  });

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        ref={surfaceRef}
        onClick={onClick}
        data-page-surface
        className={cn(
          "relative w-full overflow-hidden rounded border bg-white shadow-sm",
          onClick && "cursor-crosshair",
        )}
      >
        {hasPdfSource ? (
          <>
            <canvas ref={canvasRef} className={cn("block w-full", !isPdfRendered && "hidden")} />
            {!isPdfRendered && (
              <div className="aspect-[1/1.414] w-full animate-pulse bg-slate-100" />
            )}
            {isPdfRendered && (
              <>
                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                  {documentName}
                </div>
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                  Page {page} / {totalPages}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="aspect-[1/1.414] w-full">
              <div className="absolute inset-x-0 top-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
                <FileText className="h-3 w-3" />
                <span className="truncate">{documentName}</span>
              </div>
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
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-[9px] text-slate-400">
                Page {page} / {totalPages}
              </div>
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
