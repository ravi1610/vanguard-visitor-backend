import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedProjectsAndTasks(prisma: PrismaClient, ctx: DummySeedContext): Promise<void>;
