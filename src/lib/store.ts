import { useEffect, useState, useCallback } from "react";
import {
  initialBinders,
  initialContacts,
  type Binder,
  type BinderDocument,
  type BinderAttachment,
  type BinderSigner,
  type BinderNotifications,
  type SignatureField,
  type Contact,
} from "./mockData";

const BINDER_KEY = "goodflag.binders";
const CONTACT_KEY = "goodflag.contacts";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("goodflag:store", { detail: key }));
}

export function useBinders() {
  const [binders, setBinders] = useState<Binder[]>(initialBinders);

  useEffect(() => {
    setBinders(load(BINDER_KEY, initialBinders));
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === BINDER_KEY) {
        setBinders(load(BINDER_KEY, initialBinders));
      }
    };
    window.addEventListener("goodflag:store", onChange);
    return () => window.removeEventListener("goodflag:store", onChange);
  }, []);

  const create = useCallback(
    (data: {
      name: string;
      description?: string;
      group?: string;
      ownerName: string;
      ownerEmail: string;
      ownerInitials: string;
      documents?: BinderDocument[];
      attachments?: BinderAttachment[];
      signers?: BinderSigner[];
      signatureFields?: SignatureField[];
      notifications?: BinderNotifications;
      consolidation?: boolean;
    }) => {
      const now = new Date().toISOString();
      const next: Binder = {
        id: `b_${Date.now()}`,
        name: data.name,
        description: data.description,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        ownerInitials: data.ownerInitials,
        group: data.group?.trim() || "Utilisateurs Principaux",
        createdAt: now,
        updatedAt: now,
        status: "draft",
        progress: 0,
        consolidation: data.consolidation ?? false,
        documents: data.documents ?? [],
        attachments: data.attachments ?? [],
        signers: (data.signers ?? []).map((s) => ({ ...s, status: s.status ?? "pending" })),
        signatureFields: data.signatureFields ?? [],
        notifications: data.notifications ?? { onStart: true, onComplete: true, reminders: false },
      };
      const list = [next, ...load<Binder[]>(BINDER_KEY, initialBinders)];
      save(BINDER_KEY, list);
      return next;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    const list = load<Binder[]>(BINDER_KEY, initialBinders).filter((b) => b.id !== id);
    save(BINDER_KEY, list);
  }, []);

  const update = useCallback((id: string, patch: Partial<Binder>) => {
    const list = load<Binder[]>(BINDER_KEY, initialBinders).map((b) =>
      b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b,
    );
    save(BINDER_KEY, list);
  }, []);

  /**
   * Record a signature for a given signer: marks the signer as signed,
   * fills in all their signature fields, recomputes progress and status.
   */
  const signAs = useCallback(
    (
      binderId: string,
      signerId: string,
      payload: {
        method: BinderSigner["signatureMethod"];
        signatureData: string;
      },
    ) => {
      const list = load<Binder[]>(BINDER_KEY, initialBinders);
      const now = new Date().toISOString();
      const next = list.map((b) => {
        if (b.id !== binderId) return b;
        const signers = (b.signers ?? []).map((s) =>
          s.id === signerId
            ? {
                ...s,
                status: "signed" as const,
                signedAt: now,
                signatureMethod: payload.method,
                signatureData: payload.signatureData,
              }
            : s,
        );
        const fields = (b.signatureFields ?? []).map((f) =>
          f.signerId === signerId
            ? { ...f, signedAt: now, signatureData: payload.signatureData }
            : f,
        );
        const total = signers.length || 1;
        const signedCount = signers.filter((s) => s.status === "signed").length;
        const progress = Math.round((signedCount / total) * 100);
        const allSigned = signers.length > 0 && signedCount === signers.length;
        return {
          ...b,
          signers,
          signatureFields: fields,
          progress,
          startedAt: b.startedAt ?? now,
          status: allSigned ? ("finished" as const) : ("started" as const),
          updatedAt: now,
        };
      });
      save(BINDER_KEY, next);
    },
    [],
  );

  return { binders, create, remove, update, signAs };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);

  useEffect(() => {
    setContacts(load(CONTACT_KEY, initialContacts));
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === CONTACT_KEY) {
        setContacts(load(CONTACT_KEY, initialContacts));
      }
    };
    window.addEventListener("goodflag:store", onChange);
    return () => window.removeEventListener("goodflag:store", onChange);
  }, []);

  const create = useCallback((c: Omit<Contact, "id">) => {
    const next: Contact = { ...c, id: `c_${Date.now()}` };
    const list = [next, ...load<Contact[]>(CONTACT_KEY, initialContacts)];
    save(CONTACT_KEY, list);
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    const list = load<Contact[]>(CONTACT_KEY, initialContacts).filter((c) => c.id !== id);
    save(CONTACT_KEY, list);
  }, []);

  return { contacts, create, remove };
}
