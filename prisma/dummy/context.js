"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDummySeedCounts = getDummySeedCounts;
const DEFAULT_COUNTS = {
    units: 10,
    residents: 10,
    maintenance: 10,
    visitors: 10,
    visits: 10,
    vehicles: 10,
    staff: 10,
    projects: 5,
    tasks: 15,
    calendarEvents: 10,
    documents: 10,
    compliance: 10,
    vendors: 10,
    spaces: 10,
    violations: 10,
    packages: 10,
    bolos: 5,
    emergencyContacts: 10,
    pets: 10,
};
function parseCount(envKey, defaultVal) {
    const v = process.env[envKey];
    if (v == null || v === '')
        return defaultVal;
    const n = parseInt(v, 10);
    return Number.isNaN(n) || n < 0 ? defaultVal : n;
}
function getDummySeedCounts() {
    return {
        units: Math.max(5, parseCount('UNITS_SEED_COUNT', DEFAULT_COUNTS.units)),
        residents: Math.max(5, parseCount('RESIDENTS_SEED_COUNT', DEFAULT_COUNTS.residents)),
        maintenance: parseCount('MAINTENANCE_SEED_COUNT', DEFAULT_COUNTS.maintenance),
        visitors: parseCount('VISITORS_SEED_COUNT', DEFAULT_COUNTS.visitors),
        visits: parseCount('VISITS_SEED_COUNT', DEFAULT_COUNTS.visits),
        vehicles: parseCount('VEHICLES_SEED_COUNT', DEFAULT_COUNTS.vehicles),
        staff: parseCount('STAFF_SEED_COUNT', DEFAULT_COUNTS.staff),
        projects: parseCount('PROJECTS_SEED_COUNT', DEFAULT_COUNTS.projects),
        tasks: parseCount('TASKS_SEED_COUNT', DEFAULT_COUNTS.tasks),
        calendarEvents: parseCount('CALENDAR_EVENTS_SEED_COUNT', DEFAULT_COUNTS.calendarEvents),
        documents: parseCount('DOCUMENTS_SEED_COUNT', DEFAULT_COUNTS.documents),
        compliance: parseCount('COMPLIANCE_SEED_COUNT', DEFAULT_COUNTS.compliance),
        vendors: parseCount('VENDORS_SEED_COUNT', DEFAULT_COUNTS.vendors),
        spaces: parseCount('SPACES_SEED_COUNT', DEFAULT_COUNTS.spaces),
        violations: parseCount('VIOLATIONS_SEED_COUNT', DEFAULT_COUNTS.violations),
        packages: parseCount('PACKAGES_SEED_COUNT', DEFAULT_COUNTS.packages),
        bolos: parseCount('BOLOS_SEED_COUNT', DEFAULT_COUNTS.bolos),
        emergencyContacts: parseCount('EMERGENCY_CONTACTS_SEED_COUNT', DEFAULT_COUNTS.emergencyContacts),
        pets: parseCount('PETS_SEED_COUNT', DEFAULT_COUNTS.pets),
    };
}
//# sourceMappingURL=context.js.map