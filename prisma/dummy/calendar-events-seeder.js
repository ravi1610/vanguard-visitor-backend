"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCalendarEvents = seedCalendarEvents;
const helpers_1 = require("./helpers");
const TYPES = ['meeting', 'social', 'safety', 'maintenance'];
const LOCATIONS = ['Clubhouse', 'Pool Area', 'Building A', 'Garden Area', 'Lobby'];
async function seedCalendarEvents(prisma, ctx) {
    const { tenantId, counts } = ctx;
    const count = counts.calendarEvents;
    const data = Array.from({ length: count }, (_, i) => {
        const startAt = (0, helpers_1.dateOffset)(i * 86400000);
        const endAt = (0, helpers_1.dateOffset)(i * 86400000 + 2 * 3600000);
        return {
            id: `seed-event-${i + 1}`,
            tenantId,
            title: `Event ${i + 1}`,
            startAt,
            endAt,
            type: (0, helpers_1.at)(i, TYPES),
            location: (0, helpers_1.at)(i, LOCATIONS),
            description: `Dummy event ${i + 1}`,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.calendarEvent.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} calendar events`);
}
//# sourceMappingURL=calendar-events-seeder.js.map