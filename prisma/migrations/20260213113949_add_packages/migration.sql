-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('received', 'notified', 'picked_up', 'returned');

-- CreateEnum
CREATE TYPE "PackageSize" AS ENUM ('small', 'medium', 'large', 'oversized');

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tracking_number" TEXT,
    "carrier" TEXT,
    "status" "PackageStatus" NOT NULL DEFAULT 'received',
    "size" "PackageSize" NOT NULL DEFAULT 'medium',
    "recipient_id" TEXT,
    "recipient_name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "storage_location" TEXT,
    "is_perishable" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" TEXT,
    "picked_up_at" TIMESTAMP(3),
    "picked_up_by_id" TEXT,
    "photo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_tenant_id_idx" ON "packages"("tenant_id");

-- CreateIndex
CREATE INDEX "packages_tenant_id_status_idx" ON "packages"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "packages_recipient_id_idx" ON "packages"("recipient_id");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_picked_up_by_id_fkey" FOREIGN KEY ("picked_up_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
