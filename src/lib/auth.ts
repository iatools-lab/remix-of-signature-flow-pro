// Mock auth — demo only, NOT secure. Stores a fake session in localStorage.
const KEY = "goodflag.session";

export type Session = {
  email: string;
  name: string;
  initials: string;
};

function deriveName(email: string) {
  const local = email.split("@")[0] ?? "user";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "US").toUpperCase();
  return { name: name || "User", initials };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function login(email: string): Session {
  const { name, initials } = deriveName(email);
  const session: Session = { email, name, initials };
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("goodflag:auth"));
  return session;
}

export function logout() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("goodflag:auth"));
}
