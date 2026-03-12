/**
 * Safely parse a value into a Date. Returns the Date if valid, otherwise null.
 * Handles strings, numbers, Date objects, and Excel serial date numbers.
 */
export function parseDateSafe(value: unknown): Date | null {
  if (value == null || value === '') return null;

  // If already a valid Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
