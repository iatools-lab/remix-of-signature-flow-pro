/**
 * Génération côté client de deux artéfacts de preuve en PDF :
 *  - le "document signé" (récapitulatif lisible reprenant chaque document du
 *    parapheur, ses signataires, et la trace de chaque signature) ;
 *  - le "certificat de preuve" (rapport d'audit avec hash du parapheur,
 *    timeline complète des événements, IPs, méthodes…).
 *
 * On reste 100% client (jsPDF) pour ne pas dépendre d'un backend dans cette
 * démo : c'est bien adapté au stockage actuel (localStorage).
 */
import { jsPDF } from "jspdf";
import { getApiBaseUrl, getStoredAuthToken } from "./api";
import type { Binder, BinderSigner, SignatureField } from "./mockData";
import { formatDateTime } from "./format";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;
const SIGNED_PDF_RENDER_SCALE = 1.5;
const sourceDocumentBytesCache = new Map<string, Promise<Uint8Array>>();

const KIND_LABEL_FR: Record<string, string> = {
  "binder.created": "Parapheur créé",
  "binder.started": "Parapheur démarré",
  "binder.completed": "Parapheur terminé",
  "binder.stopped": "Parapheur arrêté",
  "binder.archived": "Parapheur archivé",
  "signer.invited": "Invitation envoyée",
  "signer.viewed": "Lien de signature ouvert",
  "signer.signed": "Signature apposée",
  "signer.declined": "Refus de signer",
  "signer.reminded": "Relance envoyée",
  "evidence.downloaded": "Preuve téléchargée",
};

/** Hash déterministe lisible (mock — pas cryptographique). */
function quickHash(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const a = (h2 >>> 0).toString(16).padStart(8, "0");
  const b = (h1 >>> 0).toString(16).padStart(8, "0");
  return `${a}${b}`.toUpperCase();
}

export function binderHash(binder: Binder): string {
  // Sérialisation stable des éléments significatifs.
  const payload = JSON.stringify({
    id: binder.id,
    name: binder.name,
    docs: (binder.documents ?? []).map((d) => ({ id: d.id, name: d.name, size: d.size })),
    signers: (binder.signers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      signedAt: s.signedAt,
      method: s.signatureMethod,
    })),
  });
  return quickHash(payload);
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Usign", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 200, 14, { align: "right" });
  doc.setTextColor(20, 20, 20);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 28);
    doc.setTextColor(20, 20, 20);
  }
}

function addFooter(doc: jsPDF, hash: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Hash : ${hash}`, 14, 290);
    doc.text(`Page ${i} / ${pages}`, 200, 290, { align: "right" });
    doc.setTextColor(20, 20, 20);
  }
}

function ensureSpace(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

async function loadPdfjs() {
  if (typeof window === "undefined") {
    throw new Error("Le rendu PDF n'est disponible que dans le navigateur.");
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

async function fetchSourceDocumentBytes(binderId: string, documentId: string) {
  const authToken = getStoredAuthToken();
  const headers = new Headers();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(
    `${getApiBaseUrl()}/binders/${binderId}/documents/${documentId}/content`,
    {
      headers,
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de récupérer le document source du parapheur.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

function loadSourceDocumentBytes(binderId: string, documentId: string) {
  const cacheKey = `${binderId}:${documentId}`;
  const cached = sourceDocumentBytesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = fetchSourceDocumentBytes(binderId, documentId).catch((error) => {
    sourceDocumentBytesCache.delete(cacheKey);
    throw error;
  });

  sourceDocumentBytesCache.set(cacheKey, pending);
  return pending;
}

function getImageFormat(data: string): "PNG" | "JPEG" {
  return /data:image\/jpe?g/i.test(data) ? "JPEG" : "PNG";
}

function drawSignedField(
  doc: jsPDF,
  field: SignatureField,
  signer: BinderSigner | undefined,
  pageWidth: number,
  pageHeight: number,
  lang: string,
) {
  const signatureValue = field.signatureData ?? signer?.signatureData;
  if (!signatureValue) {
    return;
  }

  const x = field.x * pageWidth;
  const y = field.y * pageHeight;
  const width = field.width * pageWidth;
  const height = field.height * pageHeight;
  const padding = Math.max(4, Math.min(width, height) * 0.08);

  if (field.kind === "initial") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(10, Math.min(18, height * 0.45)));
    doc.setTextColor(15, 23, 42);
    doc.text(signatureValue, x + width / 2, y + height / 2 + 4, { align: "center" });
    return;
  }

  const signerName = signer?.name ?? "Signataire";
  const signedAt = field.signedAt ?? signer?.signedAt;
  const metadataGap = signedAt ? 18 : 10;
  const signatureHeight = Math.max(14, height - padding * 2 - metadataGap);
  const signatureWidth = width - padding * 2;
  const signatureX = x + padding;
  const signatureY = y + padding;
  const signatureCenterX = x + width / 2;

  if (signatureValue.startsWith("data:image/")) {
    try {
      doc.addImage(
        signatureValue,
        getImageFormat(signatureValue),
        signatureX,
        signatureY,
        signatureWidth,
        signatureHeight,
        undefined,
        "FAST",
      );
    } catch {
      doc.setFont("times", "italic");
      doc.setFontSize(Math.max(12, Math.min(20, height * 0.34)));
      doc.text("Signature", signatureCenterX, signatureY + signatureHeight / 2, {
        align: "center",
      });
    }
  } else {
    doc.setFont("times", "italic");
    doc.setFontSize(Math.max(12, Math.min(20, height * 0.34)));
    const signatureLines = doc.splitTextToSize(signatureValue, signatureWidth).slice(0, 2);
    const signatureTextY = signatureY + Math.max(14, signatureHeight / 2);
    doc.text(signatureLines, signatureCenterX, signatureTextY, { align: "center" });
  }

  const nameY = y + height - padding - (signedAt ? 10 : 2);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(signerName, signatureWidth).slice(0, 1), signatureCenterX, nameY, {
    align: "center",
  });

  if (signedAt) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(formatDateTime(signedAt, lang), signatureCenterX, nameY + 9, {
      align: "center",
    });
  }

  doc.setTextColor(20, 20, 20);
}

type BuildSignedPdfOptions = {
  documentIds?: string[];
};

async function buildSignedPdf(binder: Binder, lang: string, options: BuildSignedPdfOptions = {}) {
  const selectedIds = options.documentIds?.length ? new Set(options.documentIds) : null;
  const documents = (binder.documents ?? []).filter(
    (document) => !selectedIds || selectedIds.has(document.id),
  );

  if (documents.length === 0) {
    throw new Error("Aucun document final n'est disponible pour ce parapheur.");
  }

  const { getDocument } = await loadPdfjs();
  let output: jsPDF | null = null;
  const signersById = new Map((binder.signers ?? []).map((signer) => [signer.id, signer]));
  const fieldsByPage = new Map<string, SignatureField[]>();

  for (const field of binder.signatureFields ?? []) {
    if (!field.signatureData) {
      continue;
    }

    const pageKey = `${field.documentId}:${field.page}`;
    const pageFields = fieldsByPage.get(pageKey);
    if (pageFields) {
      pageFields.push(field);
      continue;
    }

    fieldsByPage.set(pageKey, [field]);
  }

  const sourceDocuments = await Promise.all(
    documents.map(async (binderDocument) => ({
      binderDocument,
      sourceBytes: await loadSourceDocumentBytes(binder.id, binderDocument.id),
    })),
  );

  for (const { binderDocument, sourceBytes } of sourceDocuments) {
    const loadingTask = getDocument({ data: sourceBytes });
    const sourcePdf = await loadingTask.promise;

    try {
      for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
        const sourcePage = await sourcePdf.getPage(pageNumber);
        const exportViewport = sourcePage.getViewport({ scale: 1 });
        const renderViewport = sourcePage.getViewport({ scale: SIGNED_PDF_RENDER_SCALE });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Impossible de préparer le rendu du PDF signé.");
        }

        await sourcePage.render({ canvas, canvasContext: context, viewport: renderViewport })
          .promise;

        const pageFormat: [number, number] = [exportViewport.width, exportViewport.height];
        const orientation = exportViewport.width > exportViewport.height ? "landscape" : "portrait";

        if (!output) {
          output = new jsPDF({
            unit: "pt",
            format: pageFormat,
            orientation,
            compress: true,
          });
        } else {
          output.addPage(pageFormat, orientation);
        }

        output.addImage(
          canvas,
          "PNG",
          0,
          0,
          exportViewport.width,
          exportViewport.height,
          undefined,
          "FAST",
        );

        const pageFields = fieldsByPage.get(`${binderDocument.id}:${pageNumber}`) ?? [];

        for (const field of pageFields) {
          const signer = signersById.get(field.signerId);
          drawSignedField(output, field, signer, exportViewport.width, exportViewport.height, lang);
        }

        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      await sourcePdf.destroy();
    }
  }

  if (!output) {
    throw new Error("Impossible de générer le document signé.");
  }

  return output;
}

/** Document signé — reconstitue les pages d'origine avec les zones signées. */
export async function generateSignedPdf(binder: Binder, lang: string = "fr"): Promise<void> {
  const output = await buildSignedPdf(binder, lang);
  output.save(`${binder.name.replace(/[^a-z0-9-_]+/gi, "_")}_signe.pdf`);
}

export async function openSignedDocumentPdf(
  binder: Binder,
  documentId: string,
  lang: string = "fr",
): Promise<void> {
  const output = await buildSignedPdf(binder, lang, { documentIds: [documentId] });
  const blob = output.output("blob");
  const blobUrl = window.URL.createObjectURL(blob);
  const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!popup) {
    const anchor = window.document.createElement("a");
    anchor.href = blobUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

/** Certificat de preuve — timeline complète + hash. */
export function generateCertificatePdf(binder: Binder, lang: string = "fr"): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hash = binderHash(binder);
  addHeader(doc, "Certificat de preuve", binder.name);

  let y = 38;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Identification du parapheur", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Référence interne : ${binder.id}`, 14, y);
  y += 5;
  doc.text(`Empreinte (hash) : ${hash}`, 14, y);
  y += 5;
  doc.text(`Propriétaire : ${binder.ownerName} <${binder.ownerEmail}>`, 14, y);
  y += 5;
  doc.text(`Créé le : ${formatDateTime(binder.createdAt, lang)}`, 14, y);
  y += 5;
  if (binder.completedAt) {
    doc.text(`Terminé le : ${formatDateTime(binder.completedAt, lang)}`, 14, y);
    y += 5;
  }
  if (binder.stoppedAt) {
    doc.text(`Arrêté le : ${formatDateTime(binder.stoppedAt, lang)}`, 14, y);
    y += 5;
    if (binder.stoppedReason) {
      const lines = doc.splitTextToSize(`Motif : ${binder.stoppedReason}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5;
    }
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Journal d'audit", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const events = (binder.auditEvents ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
  if (events.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text("Aucun événement enregistré.", 14, y);
    doc.setTextColor(20, 20, 20);
  }
  for (const ev of events) {
    y = ensureSpace(doc, y, 18);
    const label = KIND_LABEL_FR[ev.kind] ?? ev.kind;
    doc.setFont("helvetica", "bold");
    doc.text(`• ${label}`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDateTime(ev.at, lang), 200, y, { align: "right" });
    y += 5;
    const who = [ev.actorName, ev.actorEmail ? `<${ev.actorEmail}>` : ""].filter(Boolean).join(" ");
    if (who) {
      doc.setTextColor(100, 116, 139);
      doc.text(`Acteur : ${who}`, 18, y);
      doc.setTextColor(20, 20, 20);
      y += 4;
    }
    if (ev.targetName || ev.targetEmail) {
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Cible : ${ev.targetName ?? ""}${ev.targetEmail ? ` <${ev.targetEmail}>` : ""}`,
        18,
        y,
      );
      doc.setTextColor(20, 20, 20);
      y += 4;
    }
    if (ev.ip) {
      doc.setTextColor(100, 116, 139);
      doc.text(`IP : ${ev.ip}`, 18, y);
      doc.setTextColor(20, 20, 20);
      y += 4;
    }
    if (ev.message) {
      const lines = doc.splitTextToSize(ev.message, 170);
      doc.text(lines, 18, y);
      y += lines.length * 4;
    }
    y += 2;
  }

  addFooter(doc, hash);
  doc.save(`${binder.name.replace(/[^a-z0-9-_]+/gi, "_")}_certificat.pdf`);
}
