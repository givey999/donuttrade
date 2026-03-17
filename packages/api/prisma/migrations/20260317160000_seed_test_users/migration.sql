-- Seed test users for admin panel testing
INSERT INTO users (id, auth_provider, minecraft_username, verification_status, balance, role, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'microsoft', 'Claude1', 'verified', 50000, 'user', NOW(), NOW()),
  (gen_random_uuid(), 'microsoft', 'Claude2', 'verified', 120000, 'user', NOW(), NOW());
