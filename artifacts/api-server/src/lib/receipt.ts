// Human-readable receipt reference shown to a parent/student, not a
// uniqueness guarantee by itself -- paymentId already is unique, this just
// makes it recognizable as a receipt number.
export function generateReceiptNumber(paymentId: number): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FR-${paymentId}-${random}`;
}
