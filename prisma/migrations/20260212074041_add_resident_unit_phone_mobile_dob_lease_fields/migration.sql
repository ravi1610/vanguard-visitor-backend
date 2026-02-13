-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "lease_begin_date" TIMESTAMP(3),
ADD COLUMN     "lease_end_date" TIMESTAMP(3),
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "unit" TEXT;
