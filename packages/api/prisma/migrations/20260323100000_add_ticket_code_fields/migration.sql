-- AlterTable
ALTER TABLE "item_deposits" ADD COLUMN "code" TEXT,
ADD COLUMN "code_expires_at" TIMESTAMP(3),
ADD COLUMN "code_verified_at" TIMESTAMP(3),
ADD COLUMN "ticket_channel_id" TEXT,
ADD COLUMN "closed_by" TEXT,
ADD COLUMN "close_reason" TEXT;

-- AlterTable
ALTER TABLE "item_withdrawals" ADD COLUMN "code" TEXT,
ADD COLUMN "code_expires_at" TIMESTAMP(3),
ADD COLUMN "code_verified_at" TIMESTAMP(3),
ADD COLUMN "ticket_channel_id" TEXT,
ADD COLUMN "closed_by" TEXT,
ADD COLUMN "close_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "item_deposits_code_key" ON "item_deposits"("code");

-- CreateIndex
CREATE UNIQUE INDEX "item_withdrawals_code_key" ON "item_withdrawals"("code");
