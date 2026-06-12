import { useCallback, useEffect, useState } from "react";
import { apiFetch, hasStoredAuthToken, notifyStoreChange } from "./api";
import type {
  AuditEvent,
  Binder,
  BinderAttachment,
  BinderDocument,
  BinderNotifications,
  BinderSigner,
  BinderStatus,
  Contact,
  SignatureField,
} from "./mockData";

const BINDER_CACHE_KEY = "usign.binders.cache";
const INBOX_BINDER_CACHE_KEY = "usign.binders.inbox.cache";
const PARTICIPATED_BINDER_CACHE_KEY = "usign.binders.participated.cache";
const CONTACT_CACHE_KEY = "usign.contacts.cache";
const BINDER_EVENT = "binders";
const CONTACT_EVENT = "contacts";

type CreateBinderInput = {
  name: string;
  description?: string;
  group?: string;
  status?: BinderStatus;
  ownerName: string;
  ownerEmail: string;
  ownerInitials: string;
  documents?: (BinderDocument & { content?: string })[];
  attachments?: BinderAttachment[];
  signers?: BinderSigner[];
  signatureFields?: SignatureField[];
  notifications?: BinderNotifications;
  consolidation?: boolean;
};

type SignPayload = {
  method: BinderSigner["signatureMethod"];
  signatureData: string;
  fieldOverrides?: Record<
    string,
    { method: BinderSigner["signatureMethod"]; signatureData: string }
  >;
};

export type BinderInvitation = {
  binderId: string;
  signerId: string;
  binderName: string;
  signerName: string;
  signerEmail: string;
  requesterName: string;
  requesterEmail: string;
  hasAccount: boolean;
  status: BinderSigner["status"];
  signPath: string;
};

type CachedBinder = Partial<Binder> & Pick<Binder, "id" | "name" | "status" | "createdAt">;

function readCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function clearCache(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

function isCachedBinder(value: unknown): value is CachedBinder {
  if (!value || typeof value !== "object") {
    return false;
  }

  const binder = value as Partial<Binder>;
  return (
    typeof binder.id === "string" &&
    typeof binder.name === "string" &&
    typeof binder.status === "string" &&
    typeof binder.createdAt === "string"
  );
}

function normalizeBinderRecord<T extends CachedBinder>(binder: T): Binder {
  return {
    ...binder,
    updatedAt:
      typeof binder.updatedAt === "string" && binder.updatedAt.trim()
        ? binder.updatedAt
        : binder.createdAt,
  } as Binder;
}

function readBinderCache(key: string) {
  return readCache<unknown[]>(key, []).filter(isCachedBinder).map(normalizeBinderRecord);
}

function getBinderSortKey(binder: Pick<Partial<Binder>, "updatedAt" | "createdAt">) {
  if (typeof binder.updatedAt === "string" && binder.updatedAt.trim()) {
    return binder.updatedAt;
  }

  if (typeof binder.createdAt === "string" && binder.createdAt.trim()) {
    return binder.createdAt;
  }

  return "";
}

function sortBinders<T extends Pick<Partial<Binder>, "updatedAt" | "createdAt">>(items: T[]) {
  return [...items].sort((left, right) =>
    getBinderSortKey(right).localeCompare(getBinderSortKey(left)),
  );
}

function sortContacts(items: Contact[]) {
  return [...items].sort((left, right) => {
    const leftName = `${left.firstName} ${left.lastName}`.trim().toLowerCase();
    const rightName = `${right.firstName} ${right.lastName}`.trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });
}

function replaceBinderCache(nextBinder: Binder) {
  const current = readBinderCache(BINDER_CACHE_KEY);
  const safeNextBinder = normalizeBinderRecord(nextBinder);
  const next = sortBinders([
    safeNextBinder,
    ...current.filter((binder) => binder.id !== safeNextBinder.id),
  ]);
  writeCache(BINDER_CACHE_KEY, next);
  return next;
}

function removeBinderFromCache(id: string) {
  const next = readBinderCache(BINDER_CACHE_KEY).filter((binder) => binder.id !== id);
  writeCache(BINDER_CACHE_KEY, next);
  return next;
}

function replaceContactsCache(nextContact: Contact) {
  const current = readCache<Contact[]>(CONTACT_CACHE_KEY, []);
  const next = sortContacts([
    nextContact,
    ...current.filter((contact) => contact.id !== nextContact.id),
  ]);
  writeCache(CONTACT_CACHE_KEY, next);
  return next;
}

function removeContactFromCache(id: string) {
  const next = readCache<Contact[]>(CONTACT_CACHE_KEY, []).filter((contact) => contact.id !== id);
  writeCache(CONTACT_CACHE_KEY, next);
  return next;
}

async function fetchBinders() {
  if (!hasStoredAuthToken()) {
    clearCache(BINDER_CACHE_KEY);
    clearCache(INBOX_BINDER_CACHE_KEY);
    clearCache(PARTICIPATED_BINDER_CACHE_KEY);
    return [] as Binder[];
  }

  const binders = await apiFetch<Binder[]>("/binders");
  const next = sortBinders(binders.map(normalizeBinderRecord));
  writeCache(BINDER_CACHE_KEY, next);
  return next;
}

async function fetchScopedBinders(path: string, cacheKey: string) {
  if (!hasStoredAuthToken()) {
    clearCache(cacheKey);
    return [] as Binder[];
  }

  const binders = await apiFetch<Binder[]>(path);
  const next = sortBinders(binders.map(normalizeBinderRecord));
  writeCache(cacheKey, next);
  return next;
}

async function fetchContacts() {
  if (!hasStoredAuthToken()) {
    clearCache(CONTACT_CACHE_KEY);
    return [] as Contact[];
  }

  const contacts = await apiFetch<Contact[]>("/contacts");
  const next = sortContacts(contacts);
  writeCache(CONTACT_CACHE_KEY, next);
  return next;
}

function emitStore(detail: string) {
  notifyStoreChange(detail);
}

export async function getPublicBinder(binderId: string, signerId: string) {
  return apiFetch<Binder>(`/public/binders/${binderId}/signers/${signerId}`, {
    skipAuth: true,
  });
}

export async function getSignerInvitation(binderId: string, signerId: string, token: string) {
  return apiFetch<BinderInvitation>(
    `/public/binders/${binderId}/signers/${signerId}/invitation?token=${encodeURIComponent(token)}`,
    {
      skipAuth: true,
    },
  );
}

async function mutatePublicBinder(path: string, body?: Record<string, unknown>) {
  const binder = await apiFetch<Binder>(path, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify(body ?? {}),
  });

  if (hasStoredAuthToken()) {
    replaceBinderCache(binder);
    emitStore(BINDER_EVENT);
  }

  return binder;
}

export async function markPublicSignerViewed(binderId: string, signerId: string) {
  return mutatePublicBinder(`/public/binders/${binderId}/signers/${signerId}/view`);
}

export async function declinePublicSigner(binderId: string, signerId: string, reason: string) {
  return mutatePublicBinder(`/public/binders/${binderId}/signers/${signerId}/decline`, {
    reason,
  });
}

export async function signPublicSigner(binderId: string, signerId: string, payload: SignPayload) {
  return mutatePublicBinder(`/public/binders/${binderId}/signers/${signerId}/sign`, payload);
}

export function useBinders() {
  const [binders, setBinders] = useState<Binder[]>([]);

  useEffect(() => {
    let active = true;

    if (hasStoredAuthToken()) {
      const cached = readBinderCache(BINDER_CACHE_KEY);
      if (cached.length) setBinders(cached);
    }

    const sync = async () => {
      try {
        const next = await fetchBinders();
        if (active) {
          setBinders(next);
        }
      } catch {
        if (!active) return;
        if (!hasStoredAuthToken()) {
          setBinders([]);
        }
      }
    };

    void sync();

    const onStoreChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === BINDER_EVENT) {
        void sync();
      }
    };

    const onAuthChange = () => {
      if (!hasStoredAuthToken()) {
        setBinders([]);
        clearCache(BINDER_CACHE_KEY);
        clearCache(INBOX_BINDER_CACHE_KEY);
        clearCache(PARTICIPATED_BINDER_CACHE_KEY);
        return;
      }

      void sync();
    };

    window.addEventListener("goodflag:store", onStoreChange);
    window.addEventListener("goodflag:auth", onAuthChange);

    return () => {
      active = false;
      window.removeEventListener("goodflag:store", onStoreChange);
      window.removeEventListener("goodflag:auth", onAuthChange);
    };
  }, []);

  const create = useCallback(async (data: CreateBinderInput) => {
    const binder = await apiFetch<Binder>("/binders", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        group: data.group,
        status: data.status,
        documents: data.documents,
        attachments: data.attachments,
        signers: data.signers,
        signatureFields: data.signatureFields,
        notifications: data.notifications,
        consolidation: data.consolidation,
      }),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);
    return binder;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch<{ ok: boolean }>(`/binders/${id}`, { method: "DELETE" });
    const next = removeBinderFromCache(id);
    setBinders(next);
    emitStore(BINDER_EVENT);
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Binder>) => {
    const binder = await apiFetch<Binder>(`/binders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);
    return binder;
  }, []);

  const appendEvent = useCallback(
    async (_binderId: string, _event: Omit<AuditEvent, "id" | "at"> & { at?: string }) => {},
    [],
  );

  const startBinder = useCallback(async (binderId: string) => {
    const binder = await apiFetch<Binder>(`/binders/${binderId}/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);
    return binder;
  }, []);

  const markSignerViewed = useCallback(async (binderId: string, signerId: string) => {
    const binder = await apiFetch<Binder>(`/binders/${binderId}/signers/${signerId}/view`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);

    return binder;
  }, []);

  const declineAs = useCallback(async (binderId: string, signerId: string, reason: string) => {
    const binder = await apiFetch<Binder>(`/binders/${binderId}/signers/${signerId}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);

    return binder;
  }, []);

  const remindSigner = useCallback(
    async (binderId: string, signerId: string, _actor: { name: string; email: string }) => {
      const binder = await apiFetch<Binder>(`/binders/${binderId}/signers/${signerId}/remind`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const next = replaceBinderCache(binder);
      setBinders(next);
      emitStore(BINDER_EVENT);
      return binder;
    },
    [],
  );

  const updateSignerInvitationEmail = useCallback(
    async (binderId: string, signerId: string, email: string) => {
      const binder = await apiFetch<Binder>(`/binders/${binderId}/signers/${signerId}/invitation`, {
        method: "PATCH",
        body: JSON.stringify({ email }),
      });

      const next = replaceBinderCache(binder);
      setBinders(next);
      emitStore(BINDER_EVENT);
      return binder;
    },
    [],
  );

  const signAs = useCallback(async (binderId: string, signerId: string, payload: SignPayload) => {
    const binder = await apiFetch<Binder>(`/binders/${binderId}/signers/${signerId}/sign`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const next = replaceBinderCache(binder);
    setBinders(next);
    emitStore(BINDER_EVENT);

    return binder;
  }, []);

  const recordDownload = useCallback(
    async (
      binderId: string,
      _actor: { name?: string; email?: string },
      what: "signed_pdf" | "certificate",
    ) => {
      const binder = await apiFetch<Binder>(`/binders/${binderId}/downloads`, {
        method: "POST",
        body: JSON.stringify({ what }),
      });

      const next = replaceBinderCache(binder);
      setBinders(next);
      emitStore(BINDER_EVENT);
      return binder;
    },
    [],
  );

  return {
    binders,
    create,
    remove,
    update,
    signAs,
    startBinder,
    markSignerViewed,
    declineAs,
    remindSigner,
    updateSignerInvitationEmail,
    appendEvent,
    recordDownload,
  };
}

function useBinderCollection(path: string, cacheKey: string) {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (hasStoredAuthToken()) {
      const cached = readBinderCache(cacheKey);
      if (cached.length) setBinders(cached);
    }

    const sync = async () => {
      setIsLoading(true);
      try {
        const next = await fetchScopedBinders(path, cacheKey);
        if (active) {
          setBinders(next);
        }
      } catch {
        if (!active) return;
        if (!hasStoredAuthToken()) {
          setBinders([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void sync();

    const onStoreChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === BINDER_EVENT) {
        void sync();
      }
    };

    const onAuthChange = () => {
      if (!hasStoredAuthToken()) {
        setBinders([]);
        clearCache(cacheKey);
        setIsLoading(false);
        return;
      }

      void sync();
    };

    window.addEventListener("goodflag:store", onStoreChange);
    window.addEventListener("goodflag:auth", onAuthChange);

    return () => {
      active = false;
      window.removeEventListener("goodflag:store", onStoreChange);
      window.removeEventListener("goodflag:auth", onAuthChange);
    };
  }, [cacheKey, path]);

  return { binders, isLoading };
}

export function useInboxBinders() {
  return useBinderCollection("/binders/inbox", INBOX_BINDER_CACHE_KEY);
}

export function useParticipatedBinders() {
  return useBinderCollection("/binders/participated", PARTICIPATED_BINDER_CACHE_KEY);
}

export function usePublicBinder(binderId: string, signerId: string) {
  const [binder, setBinder] = useState<Binder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getPublicBinder(binderId, signerId);
    setBinder(next);
    return next;
  }, [binderId, signerId]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const next = await getPublicBinder(binderId, signerId);
        if (active) {
          setBinder(next);
        }
      } catch {
        if (active) {
          setBinder(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [binderId, signerId]);

  return { binder, isLoading, refresh };
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    let active = true;

    if (hasStoredAuthToken()) {
      const cached = readCache<Contact[]>(CONTACT_CACHE_KEY, []);
      if (cached.length) setContacts(cached);
    }

    const sync = async () => {
      try {
        const next = await fetchContacts();
        if (active) {
          setContacts(next);
        }
      } catch {
        if (!active) return;
        if (!hasStoredAuthToken()) {
          setContacts([]);
        }
      }
    };

    void sync();

    const onStoreChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === CONTACT_EVENT) {
        void sync();
      }
    };

    const onAuthChange = () => {
      if (!hasStoredAuthToken()) {
        setContacts([]);
        clearCache(CONTACT_CACHE_KEY);
        return;
      }

      void sync();
    };

    window.addEventListener("goodflag:store", onStoreChange);
    window.addEventListener("goodflag:auth", onAuthChange);

    return () => {
      active = false;
      window.removeEventListener("goodflag:store", onStoreChange);
      window.removeEventListener("goodflag:auth", onAuthChange);
    };
  }, []);

  const create = useCallback(async (contact: Omit<Contact, "id">) => {
    const nextContact = await apiFetch<Contact>("/contacts", {
      method: "POST",
      body: JSON.stringify(contact),
    });

    const next = replaceContactsCache(nextContact);
    setContacts(next);
    emitStore(CONTACT_EVENT);
    return nextContact;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch<{ ok: boolean }>(`/contacts/${id}`, { method: "DELETE" });
    const next = removeContactFromCache(id);
    setContacts(next);
    emitStore(CONTACT_EVENT);
  }, []);

  return { contacts, create, remove };
}
