import { apiFetch, isApiError, setStoredAuthToken } from "./api";

const SESSION_KEY = "usign.session";
const BINDERS_CACHE_KEY = "usign.binders.cache";
const CONTACTS_CACHE_KEY = "usign.contacts.cache";

export type NotificationPrefs = {
  emailOnSent: boolean;
  emailOnSigned: boolean;
  emailOnDeclined: boolean;
  reminders: boolean;
};

export type Session = {
  email: string;
  name: string;
  initials: string;
  phone?: string;
  photo?: string; // dataURL
  notifications?: NotificationPrefs;
};

export const DEFAULT_NOTIFS: NotificationPrefs = {
  emailOnSent: true,
  emailOnSigned: true,
  emailOnDeclined: true,
  reminders: false,
};

type SessionResponse = {
  session: Session;
};

type BasicOkResponse = {
  ok: boolean;
};

export function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dispatchAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("goodflag:auth"));
  window.dispatchEvent(new Event("usign:auth"));
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Session;
    return {
      ...session,
      notifications: { ...DEFAULT_NOTIFS, ...(session.notifications ?? {}) },
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...session,
      notifications: { ...DEFAULT_NOTIFS, ...(session.notifications ?? {}) },
    }),
  );
}

function clearCachedCollections() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BINDERS_CACHE_KEY);
  localStorage.removeItem(CONTACTS_CACHE_KEY);
}

function persistSession(session: Session) {
  writeStoredSession(session);
  dispatchAuthChange();
  return session;
}

function clearAuthState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
  setStoredAuthToken(null);
  clearCachedCollections();
  dispatchAuthChange();
}

export function getSession(): Session | null {
  return readStoredSession();
}

export async function refreshSession() {
  try {
    const session = await apiFetch<Session>("/auth/session");
    return persistSession(session);
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      clearAuthState();
      return null;
    }

    throw error;
  }
}

export async function login(email: string, password: string) {
  const response = await apiFetch<SessionResponse>("/auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: email.trim(), password }),
  });

  return persistSession(response.session);
}

export async function loginWithGoogle(credential: string) {
  const response = await apiFetch<SessionResponse>("/auth/google", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ credential }),
  });

  return persistSession(response.session);
}

export async function signup(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
) {
  const response = await apiFetch<SessionResponse>("/auth/signup", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    }),
  });

  return persistSession(response.session);
}

export async function forgotPassword(email: string) {
  return apiFetch<BasicOkResponse>("/auth/forgot-password", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function verifyResetCode(token: string, code: string) {
  return apiFetch<BasicOkResponse>("/auth/reset-password/verify-code", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token, code: code.trim() }),
  });
}

export async function resetPassword(token: string, password: string, confirmPassword: string) {
  return apiFetch<BasicOkResponse>("/auth/reset-password", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      token,
      password,
      confirmPassword,
    }),
  });
}

export async function updateSession(patch: Partial<Session>) {
  const current = getSession();
  if (!current) return null;

  const body: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    body.name = patch.name ?? "";
  }

  if (Object.prototype.hasOwnProperty.call(patch, "phone")) {
    body.phone = patch.phone ?? "";
  }

  if (Object.prototype.hasOwnProperty.call(patch, "photo")) {
    body.photo = patch.photo ?? "";
  }

  if (patch.notifications) {
    body.notifications = { ...DEFAULT_NOTIFS, ...current.notifications, ...patch.notifications };
  }

  if (Object.keys(body).length === 0) {
    return current;
  }

  const session = await apiFetch<Session>("/auth/session", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return persistSession(session);
}

export async function logout() {
  try {
    await apiFetch<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (!(isApiError(error) && error.status === 401)) {
      throw error;
    }
  } finally {
    clearAuthState();
  }
}
