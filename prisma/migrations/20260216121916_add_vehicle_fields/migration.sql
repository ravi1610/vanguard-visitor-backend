-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "color" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_restricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parking_space" TEXT,
ADD COLUMN     "sticker_number" TEXT,
ADD COLUMN     "tag_id" TEXT,
ADD COLUMN     "year" INTEGER;
