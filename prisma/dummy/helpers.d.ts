export declare function at<T>(index: number, arr: readonly T[]): T;
export declare function dateOffset(ms: number): Date;
export declare function label(name: string, i: number): string;
export declare function createManyBatched<T>(createMany: (data: T[]) => Promise<unknown>, data: T[]): Promise<void>;
