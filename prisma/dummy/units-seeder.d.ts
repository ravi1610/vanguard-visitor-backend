import type { PrismaClient } from '@prisma/client';
export declare function seedUnits(prisma: PrismaClient, tenantId: string, count: number): Promise<Record<string, string>>;
