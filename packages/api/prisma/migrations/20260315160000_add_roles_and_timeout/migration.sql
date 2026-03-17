-- Add role and timeout fields to users
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN "timed_out_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "timeout_reason" TEXT;
CREATE INDEX "users_role_idx" ON "users"("role");

-- Promote .givey3917 to admin
UPDATE "users" SET "role" = 'admin' WHERE "minecraft_username" = '.givey3917';
