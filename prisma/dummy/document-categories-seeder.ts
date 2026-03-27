import type { PrismaClient } from '@prisma/client';

const DOCUMENT_CATEGORY_NAMES = [
  'Governance',
  'Insurance',
  'Financial',
  'Contracts',
  'Safety',
  'Personal',
  'Legal',
] as const;

export async function seedDocumentCategories(
  prisma: PrismaClient,
): Promise<Record<string, string>> {
  const idByName: Record<string, string> = {};

  for (const name of DOCUMENT_CATEGORY_NAMES) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const category = await prisma.documentCategory.upsert({
      where: { id: `seed-doc-category-${slug}` },
      create: {
        id: `seed-doc-category-${slug}`,
        name,
        isActive: true,
      },
      update: {
        name,
        isActive: true,
      },
    });
    idByName[name] = category.id;
  }

  console.log(`  ${DOCUMENT_CATEGORY_NAMES.length} document categories`);
  return idByName;
}
