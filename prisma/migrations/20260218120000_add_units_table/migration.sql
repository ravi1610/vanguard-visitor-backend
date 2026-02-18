-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('occupied', 'vacant', 'maintenance');

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "unit_number" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "unit_type" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'vacant',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_tenant_id_unit_number_key" ON "units"("tenant_id", "unit_number");

-- CreateIndex
CREATE INDEX "units_tenant_id_idx" ON "units"("tenant_id");

-- AddForeignKey (units -> tenants)
ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename users.unit -> users.unit_id (was a plain text field, now becomes FK)
ALTER TABLE "users" RENAME COLUMN "unit" TO "unit_id";

-- Rename maintenance.property_unit -> maintenance.unit_id
ALTER TABLE "maintenance" RENAME COLUMN "property_unit" TO "unit_id";

-- Rename packages.unit -> packages.unit_id
ALTER TABLE "packages" RENAME COLUMN "unit" TO "unit_id";

-- Add unit_id to vehicles
ALTER TABLE "vehicles" ADD COLUMN "unit_id" TEXT;

-- Add unit_id to violations
ALTER TABLE "violations" ADD COLUMN "unit_id" TEXT;

-- AddForeignKey (users -> units)
ALTER TABLE "users" ADD CONSTRAINT "users_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (vehicles -> units)
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (maintenance -> units)
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (violations -> units)
ALTER TABLE "violations" ADD CONSTRAINT "violations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (packages -> units)
ALTER TABLE "packages" ADD CONSTRAINT "packages_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
