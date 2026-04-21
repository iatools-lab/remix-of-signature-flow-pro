// Stocke la signature personnelle de l'utilisateur connecté.
// Démo only — persisté dans localStorage par email.

export type SavedSignatureMethod = "drawn" | "typed" | "image";

export type SavedSignature = {
  method: SavedSignatureMethod;
  data: string; // dataURL (drawn/image) ou texte (typed)
  updatedAt: string;
};

const PREFIX = "usign.mySignature:";

function keyFor(email: string) {
  return `${PREFIX}${email.toLowerCase()}`;
}

export function getMySignature(email: string | null | undefined): SavedSignature | null {
  if (!email || typeof window === "undefined") return null;
  const raw = localStorage.getItem(keyFor(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedSignature;
  } catch {
    return null;
  }
}

export function saveMySignature(email: string, sig: Omit<SavedSignature, "updatedAt">) {
  const value: SavedSignature = { ...sig, updatedAt: new Date().toISOString() };
  localStorage.setItem(keyFor(email), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("usign:mySignature", { detail: email }));
}

export function clearMySignature(email: string) {
  localStorage.removeItem(keyFor(email));
  window.dispatchEvent(new CustomEvent("usign:mySignature", { detail: email }));
}
