export const ALLOWED_SIGNER_EMAIL_DOMAIN = "upowa.org";

export function isAllowedSignerEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_SIGNER_EMAIL_DOMAIN}`);
}
