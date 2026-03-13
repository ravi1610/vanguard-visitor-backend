export type FilterValue = string | string[];
export type FilterHandler = (where: Record<string, unknown>, value: FilterValue) => void;

const normalizeFilterValue = (raw: string | string[] | undefined): FilterValue | undefined => {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((item) => (item === null || item === undefined ? '' : String(item)))
      .map((value) => value.trim())
      .filter((value) => value !== '');
    return normalized.length > 0 ? normalized : undefined;
  }
  const trimmed = String(raw).trim();
  return trimmed === '' ? undefined : trimmed;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const containsInsensitive = (field: string): FilterHandler => (where, value) => {
  if (Array.isArray(value)) {
    where[field] = { in: value };
    return;
  }
  where[field] = { contains: value, mode: 'insensitive' };
};

export const equals = (field: string): FilterHandler => (where, value) => {
  if (Array.isArray(value)) {
    where[field] = { in: value };
    return;
  }
  where[field] = value;
};

export function applyFilters(
  where: Record<string, unknown>,
  filters: Record<string, unknown> | undefined,
  handlers: Record<string, FilterHandler> = {},
) {
  if (!filters || !isPlainObject(filters)) return;

  const handledKeys = new Set<string>();
  for (const [key, handler] of Object.entries(handlers)) {
    const raw = filters[key];
    const value = normalizeFilterValue(raw as string | string[] | undefined);
    if (!value) continue;
    handler(where, value);
    handledKeys.add(key);
  }

  for (const [key, raw] of Object.entries(filters)) {
    if (handledKeys.has(key)) continue;
    const value = normalizeFilterValue(raw as string | string[] | undefined);
    if (!value) continue;
    if (Array.isArray(value)) {
      where[key] = { in: value };
      continue;
    }
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'false') {
      where[key] = lower === 'true';
      continue;
    }
    containsInsensitive(key)(where, value);
  }
}
