import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched } from './helpers';

const DOC_TYPES = ['PDF', 'XLSX', 'DOCX'];
const CATEGORIES = ['Governance', 'Insurance', 'Financial', 'Contracts', 'Safety'];

export async function seedDocuments(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'adminUserId'>,
): Promise<void> {
  const { tenantId, counts, adminUserId } = ctx;
  const count = counts.documents;

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-doc-${i + 1}`,
    tenantId,
    name: `Document ${i + 1}`,
    documentType: at(i, DOC_TYPES),
    category: at(i, CATEGORIES),
    uploadedByUserId: adminUserId,
  }));

  await createManyBatched((chunk) => prisma.document.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} documents`);
}
