-- Add recordedBy (who clicked "Mark as Settled"), backfill from payer for existing rows.
ALTER TABLE "Settlement" ADD COLUMN "recordedBy" TEXT;

UPDATE "Settlement" SET "recordedBy" = "fromUser" WHERE "recordedBy" IS NULL;

ALTER TABLE "Settlement" ALTER COLUMN "recordedBy" SET NOT NULL;

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
