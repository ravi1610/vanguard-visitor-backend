import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for seed');
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function main() {
  // ── Permissions ──────────────────────────────────────────────────
  const permissions = [
    'tenant.manage',
    'user.manage',
    'visitor.view',
    'visitor.manage',
    'visit.view',
    'visit.checkin',
    'visit.checkout',
    'visit.view_history',
    'staff.view',
    'staff.manage',
    'vehicles.view',
    'vehicles.manage',
    'spaces.view',
    'spaces.manage',
    'maintenance.view',
    'maintenance.manage',
    'projects.view',
    'projects.manage',
    'calendar.view',
    'calendar.manage',
    'documents.view',
    'documents.manage',
    'compliance.view',
    'compliance.manage',
    'vendors.view',
    'vendors.manage',
    'reports.view',
    'emergencyContacts.view',
    'emergencyContacts.manage',
    'pets.view',
    'pets.manage',
    'violations.view',
    'violations.manage',
    'packages.view',
    'packages.manage',
    'bolos.view',
    'bolos.manage',
    'units.view',
    'units.manage',
  ];

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key.replace('.', ' ') },
      update: {},
    });
  }

  // ── Tenant ───────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'sunset-bay' },
    create: { name: 'Sunset Bay', slug: 'sunset-bay', isActive: true },
    update: {},
  });

  // ── Roles ────────────────────────────────────────────────────────
  const role = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'tenant_owner' } },
    create: {
      tenantId: tenant.id,
      name: 'Tenant Owner',
      key: 'tenant_owner',
      description: 'Full control',
    },
    update: {},
  });

  const permIds = await prisma.permission.findMany({ select: { id: true } });
  for (const p of permIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      create: { roleId: role.id, permissionId: p.id },
      update: {},
    });
  }

  // ── Admin User ───────────────────────────────────────────────────
  const email = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    create: {
      tenantId: tenant.id,
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      userRoles: { create: { roleId: role.id } },
    },
    update: {},
    include: { userRoles: { include: { role: true } } },
  });

  // ── Resident Role ────────────────────────────────────────────────
  const residentRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'resident' } },
    create: {
      tenantId: tenant.id,
      name: 'Resident',
      key: 'resident',
      description: 'Community resident',
    },
    update: {},
  });
  const residentPermKeys = ['visitor.view', 'visit.view', 'visit.view_history'];
  for (const key of residentPermKeys) {
    const perm = await prisma.permission.findUnique({ where: { key } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: residentRole.id, permissionId: perm.id } },
        create: { roleId: residentRole.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  // ── Units ──────────────────────────────────────────────────────────
  const unitsData = [
    { unitNumber: '101', building: 'Building A', floor: '1', unitType: '2BR', status: 'occupied' as const },
    { unitNumber: '118', building: 'Building A', floor: '1', unitType: '1BR', status: 'occupied' as const },
    { unitNumber: '205', building: 'Building A', floor: '2', unitType: '1BR', status: 'occupied' as const },
    { unitNumber: '302', building: 'Building B', floor: '3', unitType: '2BR', status: 'occupied' as const },
    { unitNumber: '410', building: 'Building B', floor: '4', unitType: '3BR', status: 'occupied' as const },
    { unitNumber: '103', building: 'Building A', floor: '1', unitType: 'Studio', status: 'vacant' as const },
    { unitNumber: '215', building: 'Building A', floor: '2', unitType: '2BR', status: 'vacant' as const },
    { unitNumber: '401', building: 'Building B', floor: '4', unitType: '1BR', status: 'maintenance' as const, notes: 'Undergoing renovation' },
  ];

  const unitMap: Record<string, string> = {};
  for (const u of unitsData) {
    const id = `seed-unit-${u.unitNumber}`;
    await prisma.unit.upsert({
      where: { id },
      create: { id, tenantId: tenant.id, ...u },
      update: { tenantId: tenant.id, ...u },
    });
    unitMap[u.unitNumber] = id;
  }
  console.log(`  ${unitsData.length} units`);

  // ── Sample Residents ─────────────────────────────────────────────
  const residents = [
    { email: 'maria.garcia@example.com', firstName: 'Maria', lastName: 'Garcia', residentType: 'owner' as const, unitId: unitMap['101'], phone: '(305) 555-0101', mobile: '(786) 555-0101', dateOfBirth: new Date('1985-03-15'), leaseBeginDate: new Date('2024-01-01'), leaseEndDate: new Date('2026-12-31'), isBoardMember: true, movingDate: new Date('2024-01-15') },
    { email: 'james.wilson@example.com', firstName: 'James', lastName: 'Wilson', residentType: 'renter' as const, unitId: unitMap['205'], mobile: '(786) 555-0205', dateOfBirth: new Date('1990-07-22'), leaseBeginDate: new Date('2025-06-01'), leaseEndDate: new Date('2026-05-31'), movingDate: new Date('2025-06-01') },
    { email: 'sophia.chen@example.com', firstName: 'Sophia', lastName: 'Chen', residentType: 'president' as const, unitId: unitMap['302'], phone: '(305) 555-0302', mobile: '(786) 555-0302', dateOfBirth: new Date('1978-11-08'), isBoardMember: true, leaseBeginDate: new Date('2023-01-01'), leaseEndDate: new Date('2027-12-31') },
    { email: 'robert.johnson@example.com', firstName: 'Robert', lastName: 'Johnson', residentType: 'treasurer' as const, unitId: unitMap['410'], phone: '(305) 555-0410', mobile: '(786) 555-0410', isBoardMember: true, leaseBeginDate: new Date('2024-03-01'), leaseEndDate: new Date('2026-02-28') },
    { email: 'emily.davis@example.com', firstName: 'Emily', lastName: 'Davis', residentType: 'renter' as const, unitId: unitMap['118'], mobile: '(786) 555-0118', dateOfBirth: new Date('1995-01-30'), leaseBeginDate: new Date('2025-09-01'), leaseEndDate: new Date('2026-08-31'), movingDate: new Date('2025-09-01') },
  ];

  const residentUsers: { id: string; firstName: string; lastName: string }[] = [];
  for (const r of residents) {
    const hash = await bcrypt.hash('resident123', 10);
    const u = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: r.email } },
      create: {
        tenantId: tenant.id,
        email: r.email,
        passwordHash: hash,
        firstName: r.firstName,
        lastName: r.lastName,
        isActive: true,
        residentType: r.residentType,
        unitId: r.unitId,
        phone: r.phone ?? null,
        mobile: r.mobile ?? null,
        dateOfBirth: r.dateOfBirth ?? null,
        leaseBeginDate: r.leaseBeginDate ?? null,
        leaseEndDate: r.leaseEndDate ?? null,
        isBoardMember: r.isBoardMember ?? false,
        movingDate: r.movingDate ?? null,
        userRoles: { create: { roleId: residentRole.id } },
      },
      update: {
        unitId: r.unitId,
        residentType: r.residentType,
        phone: r.phone ?? null,
        mobile: r.mobile ?? null,
        dateOfBirth: r.dateOfBirth ?? null,
        leaseBeginDate: r.leaseBeginDate ?? null,
        leaseEndDate: r.leaseEndDate ?? null,
        isBoardMember: r.isBoardMember ?? false,
        movingDate: r.movingDate ?? null,
      },
    });
    residentUsers.push({ id: u.id, firstName: u.firstName, lastName: u.lastName });
  }

  console.log('Seed done. Tenant:', tenant.slug, '| Admin:', user.email, '| Password: admin123');
  console.log(`  ${residents.length} sample residents created (password: resident123)`);

  // ── Stop here in production ──────────────────────────────────────
  if (IS_PRODUCTION) {
    console.log('  Production mode — skipping dummy data.');
    return;
  }

  console.log('  Seeding dummy data for development...');

  // ── Staff ────────────────────────────────────────────────────────
  const staffData = [
    { firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@sunsetbay.com', phone: '(305) 555-1001', department: 'Security', position: 'Security Chief', role: 'Manager', employeeId: 'EMP-001', assignedBuilding: 'Gate House', hireDate: new Date('2022-03-15'), isActive: true },
    { firstName: 'Diana', lastName: 'Reyes', email: 'diana.reyes@sunsetbay.com', phone: '(305) 555-1002', department: 'Security', position: 'Security Guard', role: 'Officer', employeeId: 'EMP-002', assignedBuilding: 'Building A', hireDate: new Date('2023-06-01'), isActive: true },
    { firstName: 'Michael', lastName: 'Thompson', email: 'michael.t@sunsetbay.com', phone: '(305) 555-1003', department: 'Maintenance', position: 'Maintenance Lead', role: 'Supervisor', employeeId: 'EMP-003', assignedBuilding: 'All Buildings', hireDate: new Date('2021-08-10'), isActive: true },
    { firstName: 'Ana', lastName: 'Vazquez', email: 'ana.v@sunsetbay.com', phone: '(305) 555-1004', department: 'Administration', position: 'Property Manager', role: 'Manager', employeeId: 'EMP-004', assignedBuilding: 'Admin Office', hireDate: new Date('2020-01-20'), isActive: true },
    { firstName: 'Jerome', lastName: 'Williams', email: 'jerome.w@sunsetbay.com', phone: '(305) 555-1005', department: 'Maintenance', position: 'Technician', role: 'Staff', employeeId: 'EMP-005', assignedBuilding: 'Building B', hireDate: new Date('2024-02-14'), isActive: true },
    { firstName: 'Lisa', lastName: 'Park', email: 'lisa.park@sunsetbay.com', phone: '(305) 555-1006', department: 'Front Desk', position: 'Receptionist', role: 'Staff', employeeId: 'EMP-006', assignedBuilding: 'Lobby', hireDate: new Date('2024-09-01'), isActive: true },
    { firstName: 'David', lastName: 'Hernandez', email: 'david.h@sunsetbay.com', phone: '(305) 555-1007', department: 'Security', position: 'Night Guard', role: 'Officer', employeeId: 'EMP-007', assignedBuilding: 'Gate House', hireDate: new Date('2023-11-15'), isActive: false },
  ];

  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: `seed-staff-${s.employeeId}` },
      create: { id: `seed-staff-${s.employeeId}`, tenantId: tenant.id, ...s },
      update: { tenantId: tenant.id, ...s },
    });
  }
  console.log(`  ${staffData.length} staff members`);

  // ── Visitors ─────────────────────────────────────────────────────
  const visitorsData = [
    { firstName: 'John', lastName: 'Smith', email: 'john.smith@acme.com', phone: '(305) 555-2001', company: 'ACME Corp', documentId: 'DL-12345' },
    { firstName: 'Sarah', lastName: 'Connor', email: 'sarah.c@techstart.io', phone: '(305) 555-2002', company: 'TechStart', documentId: 'PP-67890' },
    { firstName: 'David', lastName: 'Lee', email: 'david.lee@plumb.com', company: 'ProPlumbing LLC', documentId: 'DL-11111' },
    { firstName: 'Patricia', lastName: 'Martinez', phone: '(786) 555-2004', company: 'FedEx', documentId: 'EMP-FDX-444' },
    { firstName: 'Kevin', lastName: 'Brown', email: 'kevin.b@gmail.com', phone: '(305) 555-2005' },
    { firstName: 'Rachel', lastName: 'Kim', email: 'rachel.kim@lawfirm.com', company: 'Kim & Associates' },
  ];

  const visitorIds: string[] = [];
  for (let i = 0; i < visitorsData.length; i++) {
    const v = visitorsData[i];
    const id = `seed-visitor-${i + 1}`;
    await prisma.visitor.upsert({
      where: { id },
      create: { id, tenantId: tenant.id, ...v },
      update: { tenantId: tenant.id, ...v },
    });
    visitorIds.push(id);
  }
  console.log(`  ${visitorsData.length} visitors`);

  // ── Visits ───────────────────────────────────────────────────────
  const now = new Date();
  const visitsData = [
    { visitorId: visitorIds[0], hostUserId: residentUsers[0].id, purpose: 'Delivery', status: 'checked_in' as const, checkInAt: new Date(now.getTime() - 30 * 60000) },
    { visitorId: visitorIds[1], hostUserId: residentUsers[2].id, purpose: 'Meeting', status: 'checked_in' as const, checkInAt: new Date(now.getTime() - 90 * 60000) },
    { visitorId: visitorIds[2], hostUserId: user.id, purpose: 'Plumbing repair', status: 'checked_in' as const, checkInAt: new Date(now.getTime() - 15 * 60000) },
    { visitorId: visitorIds[3], hostUserId: residentUsers[1].id, purpose: 'Package delivery', status: 'checked_out' as const, checkInAt: new Date(now.getTime() - 3 * 3600000), checkOutAt: new Date(now.getTime() - 2.5 * 3600000) },
    { visitorId: visitorIds[4], hostUserId: residentUsers[4].id, purpose: 'Personal visit', status: 'scheduled' as const, scheduledStart: new Date(now.getTime() + 2 * 3600000), scheduledEnd: new Date(now.getTime() + 4 * 3600000) },
    { visitorId: visitorIds[5], hostUserId: residentUsers[3].id, purpose: 'Legal consultation', status: 'checked_out' as const, checkInAt: new Date(now.getTime() - 48 * 3600000), checkOutAt: new Date(now.getTime() - 47 * 3600000) },
  ];

  for (let i = 0; i < visitsData.length; i++) {
    const v = visitsData[i];
    await prisma.visit.upsert({
      where: { id: `seed-visit-${i + 1}` },
      create: { id: `seed-visit-${i + 1}`, tenantId: tenant.id, ...v },
      update: { tenantId: tenant.id, ...v },
    });
  }
  console.log(`  ${visitsData.length} visits`);

  // ── Vehicles ─────────────────────────────────────────────────────
  const vehiclesData = [
    { plateNumber: 'FL-ABC123', make: 'Toyota', model: 'Camry', color: 'Silver', year: 2022, ownerType: 'resident' as const, ownerId: residentUsers[0].id, unitId: unitMap['101'], tagId: 'TAG-001', stickerNumber: 'STK-101', parkingSpace: 'P-101', isPrimary: true, isRestricted: false },
    { plateNumber: 'FL-DEF456', make: 'Honda', model: 'Civic', color: 'Blue', year: 2023, ownerType: 'resident' as const, ownerId: residentUsers[1].id, unitId: unitMap['205'], tagId: 'TAG-002', stickerNumber: 'STK-205', parkingSpace: 'P-205', isPrimary: true, isRestricted: false },
    { plateNumber: 'FL-GHI789', make: 'Tesla', model: 'Model 3', color: 'White', year: 2024, ownerType: 'resident' as const, ownerId: residentUsers[2].id, unitId: unitMap['302'], tagId: 'TAG-003', stickerNumber: 'STK-302', parkingSpace: 'P-302', isPrimary: true, isRestricted: false },
    { plateNumber: 'FL-JKL012', make: 'Ford', model: 'F-150', color: 'Black', year: 2021, ownerType: 'staff' as const, notes: 'Maintenance truck', tagId: 'TAG-004', parkingSpace: 'Staff-01', isPrimary: true, isRestricted: false },
    { plateNumber: 'FL-MNO345', make: 'BMW', model: 'X5', color: 'Gray', year: 2025, ownerType: 'resident' as const, ownerId: residentUsers[3].id, unitId: unitMap['410'], tagId: 'TAG-005', stickerNumber: 'STK-118', parkingSpace: 'P-118', isPrimary: true, isRestricted: false, expiresAt: new Date(now.getTime() + 365 * 86400000) },
  ];

  for (let i = 0; i < vehiclesData.length; i++) {
    await prisma.vehicle.upsert({
      where: { id: `seed-vehicle-${i + 1}` },
      create: { id: `seed-vehicle-${i + 1}`, tenantId: tenant.id, ...vehiclesData[i] },
      update: { tenantId: tenant.id, ...vehiclesData[i] },
    });
  }
  console.log(`  ${vehiclesData.length} vehicles`);

  // ── Maintenance (work orders) ────────────────────────────────────
  const maintenanceData = [
    { title: 'HVAC Repair', description: 'AC unit not cooling in unit 205', status: 'open' as const, unitId: unitMap['205'], dueDate: new Date(now.getTime() + 3 * 86400000), assignedToUserId: user.id },
    { title: 'Elevator Inspection', description: 'Annual elevator safety inspection', status: 'open' as const, dueDate: new Date(now.getTime() + 7 * 86400000) },
    { title: 'Pool Filter Replacement', description: 'Replace sand filter media', status: 'open' as const, dueDate: new Date(now.getTime() + 14 * 86400000) },
    { title: 'Parking Lot Repaint', description: 'Repaint parking lines in Lot B', status: 'in_progress' as const, assignedToUserId: user.id },
    { title: 'Lobby Light Fixture', description: 'Replace broken light fixture in main lobby', status: 'completed' as const },
  ];

  for (let i = 0; i < maintenanceData.length; i++) {
    await prisma.maintenance.upsert({
      where: { id: `seed-maint-${i + 1}` },
      create: { id: `seed-maint-${i + 1}`, tenantId: tenant.id, ...maintenanceData[i] },
      update: { tenantId: tenant.id, ...maintenanceData[i] },
    });
  }
  console.log(`  ${maintenanceData.length} maintenance work orders`);

  // ── Projects & Tasks ─────────────────────────────────────────────
  const project1 = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    create: { id: 'seed-project-1', tenantId: tenant.id, name: 'Lobby Renovation', description: 'Complete lobby redesign and modernization', status: 'active' },
    update: { tenantId: tenant.id },
  });
  const project2 = await prisma.project.upsert({
    where: { id: 'seed-project-2' },
    create: { id: 'seed-project-2', tenantId: tenant.id, name: 'Security Camera Upgrade', description: 'Replace all analog cameras with IP cameras', status: 'active' },
    update: { tenantId: tenant.id },
  });

  const tasksData = [
    { projectId: project1.id, title: 'Get contractor quotes', status: 'done' as const, dueDate: new Date(now.getTime() - 7 * 86400000) },
    { projectId: project1.id, title: 'Board approval for budget', status: 'in_progress' as const, dueDate: new Date(now.getTime() + 5 * 86400000), assignedToUserId: user.id },
    { projectId: project1.id, title: 'Order furniture', status: 'todo' as const, dueDate: new Date(now.getTime() + 21 * 86400000) },
    { projectId: project2.id, title: 'Survey existing camera positions', status: 'todo' as const, dueDate: new Date(now.getTime() + 3 * 86400000) },
    { projectId: project2.id, title: 'Purchase IP cameras', status: 'todo' as const, dueDate: new Date(now.getTime() + 14 * 86400000) },
    { projectId: project2.id, title: 'Schedule installation', status: 'todo' as const, dueDate: new Date(now.getTime() + 30 * 86400000) },
  ];

  for (let i = 0; i < tasksData.length; i++) {
    await prisma.task.upsert({
      where: { id: `seed-task-${i + 1}` },
      create: { id: `seed-task-${i + 1}`, tenantId: tenant.id, ...tasksData[i] },
      update: { tenantId: tenant.id, ...tasksData[i] },
    });
  }
  console.log(`  2 projects, ${tasksData.length} tasks`);

  // ── Calendar Events ──────────────────────────────────────────────
  const eventsData = [
    { title: 'Board Meeting', startAt: new Date(now.getTime() + 2 * 86400000), endAt: new Date(now.getTime() + 2 * 86400000 + 2 * 3600000), type: 'meeting', location: 'Clubhouse Room A', description: 'Monthly HOA board meeting' },
    { title: 'Pool Party', startAt: new Date(now.getTime() + 7 * 86400000), endAt: new Date(now.getTime() + 7 * 86400000 + 4 * 3600000), type: 'social', location: 'Pool Area', description: 'Community pool party for residents' },
    { title: 'Fire Drill', startAt: new Date(now.getTime() + 10 * 86400000), endAt: new Date(now.getTime() + 10 * 86400000 + 3600000), type: 'safety', location: 'All Buildings', description: 'Quarterly fire safety drill' },
    { title: 'Pest Control', startAt: new Date(now.getTime() + 14 * 86400000), endAt: new Date(now.getTime() + 14 * 86400000 + 6 * 3600000), type: 'maintenance', location: 'Building A & B', description: 'Monthly pest control treatment' },
    { title: 'Community Yoga', startAt: new Date(now.getTime() + 3 * 86400000), endAt: new Date(now.getTime() + 3 * 86400000 + 3600000), type: 'social', location: 'Garden Area' },
  ];

  for (let i = 0; i < eventsData.length; i++) {
    await prisma.calendarEvent.upsert({
      where: { id: `seed-event-${i + 1}` },
      create: { id: `seed-event-${i + 1}`, tenantId: tenant.id, ...eventsData[i] },
      update: { tenantId: tenant.id, ...eventsData[i] },
    });
  }
  console.log(`  ${eventsData.length} calendar events`);

  // ── Documents ────────────────────────────────────────────────────
  const documentsData = [
    { name: 'HOA Bylaws 2025', documentType: 'PDF', category: 'Governance', uploadedByUserId: user.id },
    { name: 'Insurance Certificate', documentType: 'PDF', category: 'Insurance', uploadedByUserId: user.id },
    { name: 'Budget Report Q4 2025', documentType: 'XLSX', category: 'Financial', uploadedByUserId: user.id },
    { name: 'Landscaping Contract', documentType: 'PDF', category: 'Contracts', uploadedByUserId: user.id },
    { name: 'Emergency Procedures', documentType: 'PDF', category: 'Safety', uploadedByUserId: user.id },
  ];

  for (let i = 0; i < documentsData.length; i++) {
    await prisma.document.upsert({
      where: { id: `seed-doc-${i + 1}` },
      create: { id: `seed-doc-${i + 1}`, tenantId: tenant.id, ...documentsData[i] },
      update: { tenantId: tenant.id, ...documentsData[i] },
    });
  }
  console.log(`  ${documentsData.length} documents`);

  // ── Compliance Items ─────────────────────────────────────────────
  const complianceData = [
    { name: 'Fire Extinguisher Inspection', dueDate: new Date(now.getTime() + 15 * 86400000), status: 'pending' as const, category: 'Fire Safety', notes: 'Annual inspection of all fire extinguishers' },
    { name: 'Backflow Preventer Test', dueDate: new Date(now.getTime() + 30 * 86400000), status: 'pending' as const, category: 'Plumbing', notes: 'Required annual test' },
    { name: 'Elevator Certificate Renewal', dueDate: new Date(now.getTime() + 45 * 86400000), status: 'pending' as const, category: 'Building Safety' },
    { name: 'Pool Chemical Testing', dueDate: new Date(now.getTime() - 5 * 86400000), status: 'overdue' as const, category: 'Health & Safety', notes: 'Weekly pool water testing' },
    { name: 'Insurance Policy Review', dueDate: new Date(now.getTime() - 30 * 86400000), status: 'completed' as const, category: 'Insurance' },
  ];

  for (let i = 0; i < complianceData.length; i++) {
    await prisma.complianceItem.upsert({
      where: { id: `seed-comp-${i + 1}` },
      create: { id: `seed-comp-${i + 1}`, tenantId: tenant.id, ...complianceData[i] },
      update: { tenantId: tenant.id, ...complianceData[i] },
    });
  }
  console.log(`  ${complianceData.length} compliance items`);

  // ── Vendors ──────────────────────────────────────────────────────
  const vendorsData = [
    { name: 'GreenScape Landscaping', contactName: 'Carlos Rivera', email: 'carlos@greenscape.com', phone: '(305) 555-3001', category: 'Landscaping' },
    { name: 'ProClean Janitorial', contactName: 'Janet Lee', email: 'janet@proclean.com', phone: '(305) 555-3002', category: 'Cleaning' },
    { name: 'SafeGuard Security', contactName: 'Mark Stevens', email: 'mark@safeguard.com', phone: '(305) 555-3003', category: 'Security' },
    { name: 'AquaPure Pool Services', contactName: 'Tom Wright', email: 'tom@aquapure.com', phone: '(305) 555-3004', category: 'Pool Maintenance' },
    { name: 'BrightStar Electric', contactName: 'Lisa Chang', email: 'lisa@brightstar.com', phone: '(305) 555-3005', category: 'Electrical' },
  ];

  for (let i = 0; i < vendorsData.length; i++) {
    await prisma.vendor.upsert({
      where: { id: `seed-vendor-${i + 1}` },
      create: { id: `seed-vendor-${i + 1}`, tenantId: tenant.id, ...vendorsData[i] },
      update: { tenantId: tenant.id, ...vendorsData[i] },
    });
  }
  console.log(`  ${vendorsData.length} vendors`);

  // ── Spaces & Assignments ─────────────────────────────────────────
  const spacesData = [
    { name: 'Parking Spot P-101', type: 'parking' as const },
    { name: 'Parking Spot P-102', type: 'parking' as const },
    { name: 'Parking Spot P-205', type: 'parking' as const },
    { name: 'Storage Unit S-01', type: 'other' as const },
    { name: 'Storage Unit S-02', type: 'other' as const },
  ];

  const spaceIds: string[] = [];
  for (let i = 0; i < spacesData.length; i++) {
    const id = `seed-space-${i + 1}`;
    await prisma.space.upsert({
      where: { id },
      create: { id, tenantId: tenant.id, ...spacesData[i] },
      update: { tenantId: tenant.id, ...spacesData[i] },
    });
    spaceIds.push(id);
  }

  const assignmentsData = [
    { spaceId: spaceIds[0], assigneeType: 'resident', assigneeId: residentUsers[0].id, fromDate: new Date('2024-01-01'), toDate: new Date('2026-12-31') },
    { spaceId: spaceIds[1], assigneeType: 'resident', assigneeId: residentUsers[1].id, fromDate: new Date('2025-06-01'), toDate: new Date('2026-05-31') },
    { spaceId: spaceIds[2], assigneeType: 'resident', assigneeId: residentUsers[2].id, fromDate: new Date('2023-01-01'), toDate: new Date('2027-12-31') },
    { spaceId: spaceIds[3], assigneeType: 'resident', assigneeId: residentUsers[3].id, fromDate: new Date('2024-03-01'), toDate: new Date('2026-02-28') },
  ];

  for (let i = 0; i < assignmentsData.length; i++) {
    await prisma.spaceAssignment.upsert({
      where: { id: `seed-assign-${i + 1}` },
      create: { id: `seed-assign-${i + 1}`, tenantId: tenant.id, ...assignmentsData[i] },
      update: { tenantId: tenant.id, ...assignmentsData[i] },
    });
  }
  console.log(`  ${spacesData.length} spaces, ${assignmentsData.length} assignments`);

  // ── Violations ───────────────────────────────────────────────────
  const violationsData = [
    { userId: residentUsers[1].id, title: 'Noise complaint', description: 'Loud music after 10 PM', type: 'noise' as const, status: 'open' as const, issuedDate: new Date(now.getTime() - 2 * 86400000) },
    { userId: residentUsers[4].id, title: 'Unauthorized parking', description: 'Vehicle parked in visitor spot overnight', type: 'parking' as const, status: 'open' as const, issuedDate: new Date(now.getTime() - 1 * 86400000), fineAmount: 50 },
    { userId: residentUsers[0].id, title: 'Trash in hallway', description: 'Garbage bags left in common hallway', type: 'trash' as const, status: 'under_review' as const, issuedDate: new Date(now.getTime() - 5 * 86400000) },
    { userId: residentUsers[3].id, title: 'Balcony modification', description: 'Installed satellite dish without approval', type: 'unauthorized_modification' as const, status: 'resolved' as const, issuedDate: new Date(now.getTime() - 30 * 86400000), resolvedDate: new Date(now.getTime() - 10 * 86400000), fineAmount: 200 },
  ];

  for (let i = 0; i < violationsData.length; i++) {
    await prisma.violation.upsert({
      where: { id: `seed-viol-${i + 1}` },
      create: { id: `seed-viol-${i + 1}`, tenantId: tenant.id, ...violationsData[i] },
      update: { tenantId: tenant.id, ...violationsData[i] },
    });
  }
  console.log(`  ${violationsData.length} violations`);

  // ── Packages ─────────────────────────────────────────────────────
  const packagesData = [
    { trackingNumber: '1Z999AA10123456784', carrier: 'UPS', recipientName: 'Maria Garcia', recipientId: residentUsers[0].id, unitId: unitMap['101'], size: 'medium' as const, status: 'received' as const, storageLocation: 'Mailroom Shelf A' },
    { trackingNumber: '9400111899223100001', carrier: 'USPS', recipientName: 'James Wilson', recipientId: residentUsers[1].id, unitId: unitMap['205'], size: 'small' as const, status: 'notified' as const, storageLocation: 'Mailroom Shelf B' },
    { trackingNumber: '794644790132', carrier: 'FedEx', recipientName: 'Sophia Chen', recipientId: residentUsers[2].id, unitId: unitMap['302'], size: 'large' as const, status: 'received' as const, storageLocation: 'Mailroom Floor', isPerishable: true },
    { trackingNumber: 'TBA123456789', carrier: 'Amazon', recipientName: 'Emily Davis', recipientId: residentUsers[4].id, unitId: unitMap['118'], size: 'small' as const, status: 'picked_up' as const, storageLocation: 'Mailroom Shelf A', pickedUpAt: new Date(now.getTime() - 1 * 86400000) },
  ];

  for (let i = 0; i < packagesData.length; i++) {
    await prisma.package.upsert({
      where: { id: `seed-pkg-${i + 1}` },
      create: { id: `seed-pkg-${i + 1}`, tenantId: tenant.id, receivedById: user.id, ...packagesData[i] },
      update: { tenantId: tenant.id, receivedById: user.id, ...packagesData[i] },
    });
  }
  console.log(`  ${packagesData.length} packages`);

  // ── BOLOs ────────────────────────────────────────────────────────
  const bolosData = [
    { personName: 'Unknown Male', description: 'Seen trying car door handles in Lot B around 2 AM', priority: 'high' as const, status: 'active' as const, vehicleColor: 'Dark', vehicleDescription: 'Dark sedan', createdById: user.id, expiresAt: new Date(now.getTime() + 7 * 86400000) },
    { personName: 'Jane Doe', description: 'Soliciting without permit near Building A entrance', priority: 'medium' as const, status: 'active' as const, createdById: user.id, expiresAt: new Date(now.getTime() + 14 * 86400000) },
    { personName: 'John Roe', description: 'Previous trespass warning - banned from property', priority: 'critical' as const, status: 'active' as const, licensePlate: 'FL-XYZ999', vehicleMake: 'Chevrolet', vehicleModel: 'Malibu', vehicleColor: 'Red', createdById: user.id },
  ];

  for (let i = 0; i < bolosData.length; i++) {
    await prisma.bolo.upsert({
      where: { id: `seed-bolo-${i + 1}` },
      create: { id: `seed-bolo-${i + 1}`, tenantId: tenant.id, ...bolosData[i] },
      update: { tenantId: tenant.id, ...bolosData[i] },
    });
  }
  console.log(`  ${bolosData.length} BOLOs`);

  // ── Emergency Contacts ───────────────────────────────────────────
  const emergencyData = [
    { userId: residentUsers[0].id, name: 'Pedro Garcia', relationship: 'spouse' as const, phone: '(305) 555-9001', isPrimary: true },
    { userId: residentUsers[1].id, name: 'Linda Wilson', relationship: 'parent' as const, phone: '(786) 555-9002', email: 'linda.w@gmail.com', isPrimary: true },
    { userId: residentUsers[2].id, name: 'Wei Chen', relationship: 'spouse' as const, phone: '(305) 555-9003', isPrimary: true },
  ];

  for (let i = 0; i < emergencyData.length; i++) {
    await prisma.emergencyContact.upsert({
      where: { id: `seed-emerg-${i + 1}` },
      create: { id: `seed-emerg-${i + 1}`, tenantId: tenant.id, ...emergencyData[i] },
      update: { tenantId: tenant.id, ...emergencyData[i] },
    });
  }
  console.log(`  ${emergencyData.length} emergency contacts`);

  // ── Pets ─────────────────────────────────────────────────────────
  const petsData = [
    { userId: residentUsers[0].id, name: 'Max', species: 'dog' as const, breed: 'Golden Retriever', color: 'Golden', weight: 70, registrationNumber: 'PET-001' },
    { userId: residentUsers[2].id, name: 'Luna', species: 'cat' as const, breed: 'Siamese', color: 'Cream', weight: 9, registrationNumber: 'PET-002' },
    { userId: residentUsers[4].id, name: 'Buddy', species: 'dog' as const, breed: 'French Bulldog', color: 'Brindle', weight: 25, registrationNumber: 'PET-003', isServiceAnimal: true },
  ];

  for (let i = 0; i < petsData.length; i++) {
    await prisma.pet.upsert({
      where: { id: `seed-pet-${i + 1}` },
      create: { id: `seed-pet-${i + 1}`, tenantId: tenant.id, ...petsData[i] },
      update: { tenantId: tenant.id, ...petsData[i] },
    });
  }
  console.log(`  ${petsData.length} pets`);

  console.log('  Dummy data seeding complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
