/**
 * Per-entity seed counts from env (e.g. UNITS_SEED_COUNT=200, DOCUMENTS_SEED_COUNT=500).
 * Each seeder uses its own count.
 */
export interface DummySeedCounts {
  units: number;
  residents: number;
  maintenance: number;
  visitors: number;
  visits: number;
  vehicles: number;
  staff: number;
  projects: number;
  tasks: number;
  calendarEvents: number;
  documents: number;
  compliance: number;
  vendors: number;
  spaces: number;
  violations: number;
  packages: number;
  bolos: number;
  emergencyContacts: number;
  pets: number;
}

const DEFAULT_COUNTS: DummySeedCounts = {
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

function parseCount(envKey: string, defaultVal: number): number {
  const v = process.env[envKey];
  if (v == null || v === '') return defaultVal;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? defaultVal : n;
}

/** Read all dummy seed counts from env. */
export function getDummySeedCounts(): DummySeedCounts {
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

/**
 * Shared context for dummy seeders. Passed from seed.ts after core data is created.
 */
export interface DummySeedContext {
  tenantId: string;
  counts: DummySeedCounts;
  unitMap: Record<string, string>;
  residentUsers: { id: string; firstName: string; lastName: string }[];
  adminUserId: string;
  residentRoleId: string;
  staffRoleIdByName: Record<string, string>;
  staffPositionIdByName: Record<string, string>;
  departmentIdByName: Record<string, string>;
}
