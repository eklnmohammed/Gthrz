/**
 * Single-line preview for the event form Price section (display only, no payment).
 * Returns null when the amount is empty or not a positive number.
 */
export function getEntryFeePreviewLine(amountRaw: string, currency: string): string | null {
  const trimmed = amountRaw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;

  const display = formatAmountForPreview(n);

  if (currency === "SAR") return `Entry fee: ${display} SAR`;
  if (currency === "$") return `Entry fee: $${display}`;
  if (currency === "£") return `Entry fee: £${display}`;
  return `Entry fee: ${display} ${currency}`;
}

function formatAmountForPreview(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const s = rounded.toFixed(2);
  return s.replace(/\.?0+$/, "");
}
