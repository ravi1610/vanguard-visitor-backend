/** Deterministic pick from array by index (round-robin). */
export function at<T>(index: number, arr: readonly T[]): T {
  return arr[index % arr.length];
}

/** Date offset from now in ms. */
export function dateOffset(ms: number): Date {
  return new Date(Date.now() + ms);
}

/** Unique string for seed (e.g. "Visitor 1"). */
export function label(name: string, i: number): string {
  return `${name} ${i + 1}`;
}

const BATCH_SIZE = 100;

/** Run createMany in batches to avoid huge payloads. */
export async function createManyBatched<T>(
  createMany: (data: T[]) => Promise<unknown>,
  data: T[],
): Promise<void> {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    await createMany(chunk);
  }
}
