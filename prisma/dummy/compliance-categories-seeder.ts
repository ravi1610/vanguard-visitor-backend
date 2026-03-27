import type { PrismaClient } from '@prisma/client';

const COMPLIANCE_CATEGORY_NAMES = [
  'Fire Safety',
  'Plumbing',
  'Building Safety',
  'Health & Safety',
  'Insurance',
  'Electrical',
  'General',
] as const;

export async function seedComplianceCategories(
  prisma: PrismaClient,
): Promise<Record<string, string>> {
  const idByName: Record<string, string> = {};

  for (const name of COMPLIANCE_CATEGORY_NAMES) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const category = await prisma.complianceCategory.upsert({
      where: { id: `seed-comp-category-${slug}` },
      create: {
        id: `seed-comp-category-${slug}`,
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

  console.log(`  ${COMPLIANCE_CATEGORY_NAMES.length} compliance categories`);
  return idByName;
}
