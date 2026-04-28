export function normalizePhoneForCompare(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length > 0) return digits;
  return value.trim().toLowerCase();
}

export function areSamePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhoneForCompare(a);
  const nb = normalizePhoneForCompare(b);
  return na !== "" && nb !== "" && na === nb;
}
