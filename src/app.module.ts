import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { BolosModule } from './modules/bolos/bolos.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UnitsModule } from './modules/units/units.module';
import { SettingsModule } from './modules/settings/settings.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    // ── Cache (Redis if REDIS_URL set, otherwise in-memory) ──
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('redis.url');
        if (redisUrl) {
          const { createKeyv } = await import('@keyv/redis');
          return { stores: [createKeyv(redisUrl)], ttl: 60_000 };
        }
        // Fallback: in-memory cache (zero-config for local dev)
        return { ttl: 60_000 };
      },
    }),

    // ── Rate Limiting (100 req/min global) ──
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),

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
    BolosModule,
    TasksModule,
    UnitsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
