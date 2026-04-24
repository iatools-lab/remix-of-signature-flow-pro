export type BinderStatus = "draft" | "started" | "finished" | "stopped" | "archived";

export type BinderDocument = {
  id: string;
  name: string;
  size?: number;
  pages?: number; // mocked page count
};

export type BinderAttachment = {
  id: string;
  name: string;
  size?: number;
};

export type SignerStatus = "pending" | "signed" | "declined";

export type BinderSigner = {
  id: string;
  order: number;
  name: string;
  email: string;
  color?: string; // assigned color for placement
  status?: SignerStatus;
  signedAt?: string;
  signatureMethod?: "drawn" | "typed" | "image" | "otp";
  signatureData?: string; // dataURL or typed name
  /** Dernière fois que le signataire a ouvert le lien de signature. */
  viewedAt?: string;
  /** Date de refus, si le signataire a refusé de signer. */
  declinedAt?: string;
  /** Motif du refus saisi par le signataire. */
  declinedReason?: string;
  /** IP simulée capturée lors de la signature/refus. */
  ip?: string;
};

/** Catégories d'événements applicatifs visibles dans la timeline. */
export type AuditEventKind =
  | "binder.created"
  | "binder.started"
  | "binder.completed"
  | "binder.stopped"
  | "binder.archived"
  | "signer.invited"
  | "signer.viewed"
  | "signer.signed"
  | "signer.declined"
  | "signer.reminded"
  | "evidence.downloaded";

export type AuditEvent = {
  id: string;
  kind: AuditEventKind;
  /** ISO timestamp */
  at: string;
  /** Acteur lisible (nom + email). */
  actorName?: string;
  actorEmail?: string;
  /** Cible (autre participant impacté). */
  targetName?: string;
  targetEmail?: string;
  /** IP simulée. */
  ip?: string;
  /** Texte libre additionnel (ex. motif de refus). */
  message?: string;
};

export type SignatureFieldKind = "signature" | "initial";

export type SignatureField = {
  id: string;
  documentId: string;
  page: number; // 1-based
  x: number; // 0..1 relative
  y: number; // 0..1 relative
  width: number; // 0..1 relative
  height: number; // 0..1 relative
  signerId: string;
  /** "signature" = full signature ; "initial" = paraphe (initiales auto). */
  kind?: SignatureFieldKind;
  signedAt?: string;
  signatureData?: string;
};

/** Returns initials (max 3 chars) from a full name, e.g. "Jeanne Marie Dupont" -> "JMD". */
export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export type BinderNotifications = {
  onStart: boolean;
  onComplete: boolean;
  reminders: boolean;
};

export type Binder = {
  id: string;
  name: string;
  description?: string;
  ownerName: string;
  ownerEmail: string;
  ownerInitials: string;
  group: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stoppedAt?: string;
  stoppedReason?: string;
  updatedAt: string;
  status: BinderStatus;
  progress: number;
  externalArchive?: string;
  consolidation: boolean;
  documents?: BinderDocument[];
  attachments?: BinderAttachment[];
  signers?: BinderSigner[];
  signatureFields?: SignatureField[];
  notifications?: BinderNotifications;
  /** Journal d'audit applicatif (chronologique, le plus ancien en premier). */
  auditEvents?: AuditEvent[];
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
};

export const SIGNER_COLORS = [
  "#0EA5E9",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

export const initialBinders: Binder[] = [
  {
    id: "b1",
    name: "Contrat de prestation – Acme",
    description: "Signature du contrat annuel.",
    ownerName: "MackoSolutions Trainings",
    ownerEmail: "macko.solutions.trainings@gmail.com",
    ownerInitials: "MT",
    group: "Utilisateurs Principaux",
    createdAt: "2026-04-18T09:30:00Z",
    startedAt: "2026-04-18T10:00:00Z",
    updatedAt: "2026-04-19T14:22:00Z",
    status: "started",
    progress: 50,
    consolidation: true,
  },
  {
    id: "b2",
    name: "NDA – Partenaire Lex",
    ownerName: "MackoSolutions Trainings",
    ownerEmail: "macko.solutions.trainings@gmail.com",
    ownerInitials: "MT",
    group: "Utilisateurs Principaux",
    createdAt: "2026-04-15T11:10:00Z",
    updatedAt: "2026-04-15T11:10:00Z",
    status: "draft",
    progress: 0,
    consolidation: false,
  },
  {
    id: "b3",
    name: "Avenant RH – Q2",
    ownerName: "MackoSolutions Trainings",
    ownerEmail: "macko.solutions.trainings@gmail.com",
    ownerInitials: "MT",
    group: "RH",
    createdAt: "2026-03-20T08:00:00Z",
    startedAt: "2026-03-21T09:00:00Z",
    updatedAt: "2026-04-01T16:45:00Z",
    status: "finished",
    progress: 100,
    consolidation: true,
  },
  {
    id: "b4",
    name: "Devis fournisseur",
    ownerName: "MackoSolutions Trainings",
    ownerEmail: "macko.solutions.trainings@gmail.com",
    ownerInitials: "MT",
    group: "Achats",
    createdAt: "2026-02-10T08:00:00Z",
    updatedAt: "2026-02-12T10:00:00Z",
    status: "stopped",
    progress: 30,
    consolidation: false,
  },
  {
    id: "b5",
    name: "Bail commercial 2025",
    ownerName: "MackoSolutions Trainings",
    ownerEmail: "macko.solutions.trainings@gmail.com",
    ownerInitials: "MT",
    group: "Juridique",
    createdAt: "2025-12-01T08:00:00Z",
    startedAt: "2025-12-02T08:00:00Z",
    updatedAt: "2026-01-15T08:00:00Z",
    status: "archived",
    progress: 100,
    externalArchive: "GED-2025-001",
    consolidation: true,
  },
];

export const initialContacts: Contact[] = [
  { id: "c1", firstName: "Alice", lastName: "Martin", email: "alice.martin@acme.com", phone: "+33 6 12 34 56 78", company: "Acme" },
  { id: "c2", firstName: "Jean", lastName: "Dupont", email: "j.dupont@lex.com", company: "Lex Partners" },
  { id: "c3", firstName: "Sara", lastName: "Bernard", email: "s.bernard@globex.io", phone: "+33 7 55 22 11 00", company: "Globex" },
];
