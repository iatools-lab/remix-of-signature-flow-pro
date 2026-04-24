import { useEffect, useState, useCallback } from "react";
import {
  initialBinders,
  initialContacts,
  mockIp,
  type AuditEvent,
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
      const id = `b_${Date.now()}`;
      const initialEvent: AuditEvent = {
        id: `ev_${Date.now()}`,
        kind: "binder.created",
        at: now,
        actorName: data.ownerName,
        actorEmail: data.ownerEmail,
        ip: mockIp(),
      };
      const next: Binder = {
        id,
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
        auditEvents: [initialEvent],
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

  /** Append a single audit event to a binder. */
  const appendEvent = useCallback(
    (binderId: string, event: Omit<AuditEvent, "id" | "at"> & { at?: string }) => {
      const now = event.at ?? new Date().toISOString();
      const list = load<Binder[]>(BINDER_KEY, initialBinders).map((b) => {
        if (b.id !== binderId) return b;
        const ev: AuditEvent = {
          id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          at: now,
          ...event,
        };
        return {
          ...b,
          auditEvents: [...(b.auditEvents ?? []), ev],
          updatedAt: now,
        };
      });
      save(BINDER_KEY, list);
    },
    [],
  );

  /**
   * Mark a binder as started (sent to signers). Logs invitation events for
   * every pending signer so the audit trail shows when each one was notified.
   */
  const startBinder = useCallback((binderId: string) => {
    const list = load<Binder[]>(BINDER_KEY, initialBinders);
    const now = new Date().toISOString();
    const next = list.map((b) => {
      if (b.id !== binderId) return b;
      const events: AuditEvent[] = [
        ...(b.auditEvents ?? []),
        {
          id: `ev_${Date.now()}_s`,
          kind: "binder.started",
          at: now,
          actorName: b.ownerName,
          actorEmail: b.ownerEmail,
          ip: mockIp(),
        },
        ...(b.signers ?? []).map<AuditEvent>((s, i) => ({
          id: `ev_${Date.now()}_inv_${i}`,
          kind: "signer.invited",
          at: now,
          actorName: b.ownerName,
          actorEmail: b.ownerEmail,
          targetName: s.name,
          targetEmail: s.email,
          ip: mockIp(),
        })),
      ];
      return {
        ...b,
        status: "started" as const,
        startedAt: now,
        updatedAt: now,
        auditEvents: events,
      };
    });
    save(BINDER_KEY, next);
  }, []);

  /** Mark that a signer has opened the signing page (only logs once). */
  const markSignerViewed = useCallback((binderId: string, signerId: string) => {
    const list = load<Binder[]>(BINDER_KEY, initialBinders);
    const now = new Date().toISOString();
    const next = list.map((b) => {
      if (b.id !== binderId) return b;
      const signer = b.signers?.find((s) => s.id === signerId);
      if (!signer || signer.viewedAt || signer.status === "signed") return b;
      const ip = mockIp();
      const signers = (b.signers ?? []).map((s) =>
        s.id === signerId ? { ...s, viewedAt: now, ip: s.ip ?? ip } : s,
      );
      const events: AuditEvent[] = [
        ...(b.auditEvents ?? []),
        {
          id: `ev_${Date.now()}_v`,
          kind: "signer.viewed",
          at: now,
          actorName: signer.name,
          actorEmail: signer.email,
          ip,
        },
      ];
      return { ...b, signers, auditEvents: events, updatedAt: now };
    });
    save(BINDER_KEY, next);
  }, []);

  /** A signer refuses to sign and provides a reason. */
  const declineAs = useCallback(
    (binderId: string, signerId: string, reason: string) => {
      const list = load<Binder[]>(BINDER_KEY, initialBinders);
      const now = new Date().toISOString();
      const ip = mockIp();
      const next = list.map((b) => {
        if (b.id !== binderId) return b;
        const signer = b.signers?.find((s) => s.id === signerId);
        if (!signer) return b;
        const signers = (b.signers ?? []).map((s) =>
          s.id === signerId
            ? {
                ...s,
                status: "declined" as const,
                declinedAt: now,
                declinedReason: reason,
                ip,
              }
            : s,
        );
        const events: AuditEvent[] = [
          ...(b.auditEvents ?? []),
          {
            id: `ev_${Date.now()}_d`,
            kind: "signer.declined",
            at: now,
            actorName: signer.name,
            actorEmail: signer.email,
            ip,
            message: reason,
          },
          {
            id: `ev_${Date.now()}_dst`,
            kind: "binder.stopped",
            at: now,
            actorName: signer.name,
            actorEmail: signer.email,
            ip,
            message: `Refus de ${signer.name}`,
          },
        ];
        return {
          ...b,
          signers,
          auditEvents: events,
          status: "stopped" as const,
          stoppedAt: now,
          stoppedReason: `${signer.name} a refusé : ${reason}`,
          updatedAt: now,
        };
      });
      save(BINDER_KEY, next);
    },
    [],
  );

  /** Send a reminder to a pending signer (audit only). */
  const remindSigner = useCallback(
    (binderId: string, signerId: string, actor: { name: string; email: string }) => {
      const list = load<Binder[]>(BINDER_KEY, initialBinders);
      const now = new Date().toISOString();
      const next = list.map((b) => {
        if (b.id !== binderId) return b;
        const signer = b.signers?.find((s) => s.id === signerId);
        if (!signer || signer.status === "signed") return b;
        const events: AuditEvent[] = [
          ...(b.auditEvents ?? []),
          {
            id: `ev_${Date.now()}_r`,
            kind: "signer.reminded",
            at: now,
            actorName: actor.name,
            actorEmail: actor.email,
            targetName: signer.name,
            targetEmail: signer.email,
            ip: mockIp(),
          },
        ];
        return { ...b, auditEvents: events, updatedAt: now };
      });
      save(BINDER_KEY, next);
    },
    [],
  );

  /**
   * Record a signature for a given signer: marks the signer as signed,
   * fills in all their signature fields, recomputes progress and status.
   *
   * If `fieldOverrides` is provided, each field id present uses its own
   * (method, signatureData) pair instead of the canonical one. This is used
   * to mix full signatures and "initial" (paraphe) zones in the same pass.
   */
  const signAs = useCallback(
    (
      binderId: string,
      signerId: string,
      payload: {
        method: BinderSigner["signatureMethod"];
        signatureData: string;
        fieldOverrides?: Record<
          string,
          { method: BinderSigner["signatureMethod"]; signatureData: string }
        >;
      },
    ) => {
      const list = load<Binder[]>(BINDER_KEY, initialBinders);
      const now = new Date().toISOString();
      const ip = mockIp();
      const next = list.map((b) => {
        if (b.id !== binderId) return b;
        const previousSigner = b.signers?.find((s) => s.id === signerId);
        const signers = (b.signers ?? []).map((s) =>
          s.id === signerId
            ? {
                ...s,
                status: "signed" as const,
                signedAt: now,
                signatureMethod: payload.method,
                signatureData: payload.signatureData,
                ip: s.ip ?? ip,
              }
            : s,
        );
        const fields = (b.signatureFields ?? []).map((f) => {
          if (f.signerId !== signerId) return f;
          const override = payload.fieldOverrides?.[f.id];
          return {
            ...f,
            signedAt: now,
            signatureData: override?.signatureData ?? payload.signatureData,
          };
        });
        const total = signers.length || 1;
        const signedCount = signers.filter((s) => s.status === "signed").length;
        const progress = Math.round((signedCount / total) * 100);
        const allSigned = signers.length > 0 && signedCount === signers.length;
        const events: AuditEvent[] = [...(b.auditEvents ?? [])];
        events.push({
          id: `ev_${Date.now()}_sg`,
          kind: "signer.signed",
          at: now,
          actorName: previousSigner?.name,
          actorEmail: previousSigner?.email,
          ip,
          message: `Méthode : ${payload.method ?? "drawn"}`,
        });
        if (allSigned) {
          events.push({
            id: `ev_${Date.now()}_done`,
            kind: "binder.completed",
            at: now,
            ip,
          });
        }
        return {
          ...b,
          signers,
          signatureFields: fields,
          progress,
          startedAt: b.startedAt ?? now,
          completedAt: allSigned ? now : b.completedAt,
          status: allSigned ? ("finished" as const) : ("started" as const),
          updatedAt: now,
          auditEvents: events,
        };
      });
      save(BINDER_KEY, next);
    },
    [],
  );

  /** Audit-only: record an evidence download (PDF signé / certificat). */
  const recordDownload = useCallback(
    (
      binderId: string,
      actor: { name?: string; email?: string },
      what: "signed_pdf" | "certificate",
    ) => {
      const list = load<Binder[]>(BINDER_KEY, initialBinders);
      const now = new Date().toISOString();
      const next = list.map((b) => {
        if (b.id !== binderId) return b;
        const events: AuditEvent[] = [
          ...(b.auditEvents ?? []),
          {
            id: `ev_${Date.now()}_dl`,
            kind: "evidence.downloaded",
            at: now,
            actorName: actor.name,
            actorEmail: actor.email,
            ip: mockIp(),
            message: what === "signed_pdf" ? "PDF signé" : "Certificat de preuve",
          },
        ];
        return { ...b, auditEvents: events };
      });
      save(BINDER_KEY, next);
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
    appendEvent,
    recordDownload,
  };
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
