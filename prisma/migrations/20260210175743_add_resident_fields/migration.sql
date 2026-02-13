-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_board_member" BOOLEAN,
ADD COLUMN     "is_handicapped" BOOLEAN,
ADD COLUMN     "moving_date" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "opt_in_electronic_communications" BOOLEAN,
ADD COLUMN     "other_contact_info" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "work_info" TEXT;
