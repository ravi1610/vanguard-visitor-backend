import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { VisitsModule } from './modules/visits/visits.module';
import { StaffModule } from './modules/staff/staff.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EmergencyContactsModule } from './modules/emergency-contacts/emergency-contacts.module';
import { PetsModule } from './modules/pets/pets.module';
import { ViolationsModule } from './modules/violations/violations.module';
import { PackagesModule } from './modules/packages/packages.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    RbacModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    VisitorsModule,
    VisitsModule,
    StaffModule,
    VehiclesModule,
    VendorsModule,
    ComplianceModule,
    DocumentsModule,
    SpacesModule,
    MaintenanceModule,
    CalendarModule,
    ProjectsModule,
    ReportsModule,
    EmergencyContactsModule,
    PetsModule,
    ViolationsModule,
    PackagesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
