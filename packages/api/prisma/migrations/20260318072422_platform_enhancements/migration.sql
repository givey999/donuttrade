-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "border_color" TEXT,
ADD COLUMN     "username_color" TEXT,
ADD COLUMN     "username_font" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trading_volume" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_cosmetics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unlocked_colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlocked_fonts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hidden_mode_purchased" BOOLEAN NOT NULL DEFAULT false,
    "hidden_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_cosmetics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_cosmetics_user_id_key" ON "user_cosmetics"("user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed platform settings
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('commission_rate', '0.02', NOW()),
  ('hidden_mode_price', '10000000', NOW()),
  ('maintenance_enabled', 'false', NOW()),
  ('maintenance_message', '', NOW())
ON CONFLICT (key) DO NOTHING;
