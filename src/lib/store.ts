import { useEffect, useState, useCallback } from "react";
import {
  initialBinders,
  initialContacts,
  type Binder,
  type BinderDocument,
  type BinderSigner,
  type BinderNotifications,
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
  const [binders, setBinders] = useState<Binder[]>(() => load(BINDER_KEY, initialBinders));

  useEffect(() => {
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
      signers?: BinderSigner[];
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
        signers: data.signers ?? [],
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

  return { binders, create, remove, update };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>(() => load(CONTACT_KEY, initialContacts));

  useEffect(() => {
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
