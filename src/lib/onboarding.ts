// Tracks first-login onboarding progress per user (demo only, localStorage).

const KEY_PREFIX = "usign.onboarding:";
const DISMISS_PREFIX = "usign.onboardingDismissed:";

function k(email: string) {
  return `${KEY_PREFIX}${email.toLowerCase()}`;
}
function kd(email: string) {
  return `${DISMISS_PREFIX}${email.toLowerCase()}`;
}

export function isOnboardingDismissed(email: string | null | undefined): boolean {
  if (!email || typeof window === "undefined") return false;
  return localStorage.getItem(kd(email)) === "1";
}

export function dismissOnboarding(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(kd(email), "1");
  window.dispatchEvent(new CustomEvent("usign:onboarding", { detail: email }));
}

export function resetOnboarding(email: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(kd(email));
  localStorage.removeItem(k(email));
  window.dispatchEvent(new CustomEvent("usign:onboarding", { detail: email }));
}
