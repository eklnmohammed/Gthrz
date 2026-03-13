/**
 * Generate a 6-character invite code using uppercase letters and digits.
 * Excludes ambiguous characters (0, O, 1, I, L) for readability.
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
