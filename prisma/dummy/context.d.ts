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
export declare function getDummySeedCounts(): DummySeedCounts;
export interface DummySeedContext {
    tenantId: string;
    counts: DummySeedCounts;
    unitMap: Record<string, string>;
    residentUsers: {
        id: string;
        firstName: string;
        lastName: string;
    }[];
    adminUserId: string;
    residentRoleId: string;
    staffRoleIdByName: Record<string, string>;
    staffPositionIdByName: Record<string, string>;
    departmentIdByName: Record<string, string>;
}
