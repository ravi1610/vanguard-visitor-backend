-- CreateEnum
CREATE TYPE "BoloStatus" AS ENUM ('active', 'resolved', 'expired');

-- CreateEnum
CREATE TYPE "BoloPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "bolos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "person_name" TEXT NOT NULL,
    "description" TEXT,
    "vehicle_make" TEXT,
    "vehicle_model" TEXT,
    "vehicle_color" TEXT,
    "vehicle_description" TEXT,
    "license_plate" TEXT,
    "photo_url" TEXT,
    "notes" TEXT,
    "status" "BoloStatus" NOT NULL DEFAULT 'active',
    "priority" "BoloPriority" NOT NULL DEFAULT 'medium',
    "created_by_id" TEXT,
    "resolved_by_id" TEXT,
    "resolved_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bolos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bolos_tenant_id_idx" ON "bolos"("tenant_id");

-- CreateIndex
CREATE INDEX "bolos_tenant_id_status_idx" ON "bolos"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolos" ADD CONSTRAINT "bolos_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
