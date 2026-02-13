-- CreateEnum
CREATE TYPE "ResidentType" AS ENUM ('president', 'vice_president', 'treasurer', 'owner', 'renter');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resident_type" "ResidentType";
