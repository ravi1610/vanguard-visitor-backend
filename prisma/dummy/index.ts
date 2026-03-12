import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { seedResidents } from './residents-seeder';
import { seedStaff } from './staff-seeder';
import { seedVisitors } from './visitors-seeder';
import { seedVisits } from './visits-seeder';
import { seedVehicles } from './vehicles-seeder';
import { seedProjectsAndTasks } from './projects-tasks-seeder';
import { seedCalendarEvents } from './calendar-events-seeder';
import { seedDocuments } from './documents-seeder';
import { seedComplianceItems } from './compliance-seeder';
import { seedVendors } from './vendors-seeder';
import { seedSpacesAndAssignments } from './spaces-assignments-seeder';
import { seedViolations } from './violations-seeder';
import { seedPackages } from './packages-seeder';
import { seedBolos } from './bolos-seeder';
import { seedEmergencyContacts } from './emergency-contacts-seeder';
import { seedPets } from './pets-seeder';
import { seedMaintenance } from './maintenance-seeder';

export type { DummySeedContext, DummySeedCounts } from './context';
export { getDummySeedCounts } from './context';
export { seedUnits } from './units-seeder';

export async function runDummySeed(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const residentUsers = await seedResidents(prisma, ctx);
  const ctxWithResidents = { ...ctx, residentUsers };

  await seedStaff(prisma, ctxWithResidents);
  const visitorIds = await seedVisitors(prisma, ctxWithResidents);
  await seedVisits(prisma, { ...ctxWithResidents, visitorIds });
  await seedVehicles(prisma, ctxWithResidents);
  await seedProjectsAndTasks(prisma, ctxWithResidents);
  await seedCalendarEvents(prisma, ctxWithResidents);
  await seedDocuments(prisma, ctxWithResidents);
  await seedComplianceItems(prisma, ctxWithResidents);
  await seedVendors(prisma, ctxWithResidents);
  await seedSpacesAndAssignments(prisma, ctxWithResidents);
  await seedViolations(prisma, ctxWithResidents);
  await seedPackages(prisma, ctxWithResidents);
  await seedBolos(prisma, ctxWithResidents);
  await seedEmergencyContacts(prisma, ctxWithResidents);
  await seedPets(prisma, ctxWithResidents);
  await seedMaintenance(prisma, ctxWithResidents);
  console.log('  Dummy data seeding complete!');
}
