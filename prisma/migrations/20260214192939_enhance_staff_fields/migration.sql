-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "address" TEXT,
ADD COLUMN     "assigned_building" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "employee_id" TEXT,
ADD COLUMN     "hire_date" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "position" TEXT;
