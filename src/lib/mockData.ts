export type BinderStatus = "draft" | "started" | "finished" | "stopped" | "archived";

export type BinderDocument = {
  id: string;
  name: string;
  size?: number;
};

export type BinderSigner = {
  id: string;
  order: number;
  name: string;
  email: string;
};

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
  updatedAt: string;
  status: BinderStatus;
  progress: number;
  externalArchive?: string;
  consolidation: boolean;
  documents?: BinderDocument[];
  signers?: BinderSigner[];
  notifications?: BinderNotifications;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
};

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
