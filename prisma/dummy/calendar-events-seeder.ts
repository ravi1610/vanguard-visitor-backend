import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const TYPES = ['meeting', 'social', 'safety', 'maintenance'];
const LOCATIONS = ['Clubhouse', 'Pool Area', 'Building A', 'Garden Area', 'Lobby'];

export async function seedCalendarEvents(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts'>,
): Promise<void> {
  const { tenantId, counts } = ctx;
  const count = counts.calendarEvents;

  const data = Array.from({ length: count }, (_, i) => {
    const startAt = dateOffset(i * 86400000);
    const endAt = dateOffset(i * 86400000 + 2 * 3600000);
    return {
      id: `seed-event-${i + 1}`,
      tenantId,
      title: `Event ${i + 1}`,
      startAt,
      endAt,
      type: at(i, TYPES),
      location: at(i, LOCATIONS),
      description: `Dummy event ${i + 1}`,
    };
  });

  await createManyBatched((chunk) => prisma.calendarEvent.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} calendar events`);
}
