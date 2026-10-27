/** The API sends integer cents; the UI works in rand. Rounds to the nearest cent. */
export const centsToRand = (cents: number): number => Math.round(cents) / 100;

/** "R25" for whole rand, "R25.50" otherwise; sums of floats are rounded to the cent first. */
export function formatRand(rand: number | null | undefined): string {
  const cents = Math.round((rand ?? 0) * 100);
  const whole = cents % 100 === 0;
  return 'R' + (whole ? String(cents / 100) : (cents / 100).toFixed(2));
}

/** The UI works in rand; the API takes integer cents. Rounds to the nearest cent. */
export const randToCents = (rand: number): number => Math.round(rand * 100);
