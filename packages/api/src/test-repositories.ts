/**
 * Phase 1 Repository Integration Tests
 * Run with: npx tsx src/test-repositories.ts
 */

import { prisma, connectDatabase, disconnectDatabase } from './services/database.js';
import { userRepository } from './repositories/user.repository.js';
import { sessionRepository } from './repositories/session.repository.js';
import { authStateRepository } from './repositories/auth-state.repository.js';
import { randomUUID } from 'crypto';

async function testRepositories() {
  console.log('🧪 Starting Phase 1 Repository Tests (Multi-Auth)...\n');
  console.log('='.repeat(60) + '\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    await connectDatabase();
    console.log('✓ Database connected\n');

    // ========================================================================
    // TEST 1: Create user with Microsoft auth
    // ========================================================================
    console.log('Test 1: Create user with Microsoft auth');
    console.log('-'.repeat(40));

    const msUser = await userRepository.create({
      authProvider: 'microsoft',
      microsoftId: 'test-ms-id-' + Date.now(),
      minecraftUsername: 'TestJavaUser',
    });

    if (msUser.id && msUser.authProvider === 'microsoft' && msUser.verificationStatus === 'pending') {
      console.log(`  ✓ Created user: ${msUser.id}`);
      console.log(`  ✓ Auth provider: ${msUser.authProvider}`);
      console.log(`  ✓ Verification status: ${msUser.verificationStatus}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to create Microsoft user correctly');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 2: Create user with Discord auth
    // ========================================================================
    console.log('Test 2: Create user with Discord auth');
    console.log('-'.repeat(40));

    const discordUser = await userRepository.create({
      authProvider: 'discord',
      discordId: 'test-discord-id-' + Date.now(),
      discordUsername: 'TestDiscordUser',
      minecraftUsername: '.TestBedrockUser',
    });

    if (discordUser.authProvider === 'discord' && discordUser.minecraftUsername === '.TestBedrockUser') {
      console.log(`  ✓ Created user: ${discordUser.id}`);
      console.log(`  ✓ Auth provider: ${discordUser.authProvider}`);
      console.log(`  ✓ Username: ${discordUser.minecraftUsername}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to create Discord user correctly');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 3: Create user with email auth
    // ========================================================================
    console.log('Test 3: Create user with email auth');
    console.log('-'.repeat(40));

    const emailUser = await userRepository.create({
      authProvider: 'email',
      email: 'test-' + Date.now() + '@example.com',
      passwordHash: '$2b$12$fakehashfortest',
      minecraftUsername: 'TestEmailUser',
    });

    if (emailUser.authProvider === 'email' && emailUser.email && emailUser.passwordHash) {
      console.log(`  ✓ Created user: ${emailUser.id}`);
      console.log(`  ✓ Auth provider: ${emailUser.authProvider}`);
      console.log(`  ✓ Email: ${emailUser.email}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to create email user correctly');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 4: Find by Microsoft ID
    // ========================================================================
    console.log('Test 4: Find by Microsoft ID');
    console.log('-'.repeat(40));

    const foundMs = await userRepository.findByMicrosoftId(msUser.microsoftId!);

    if (foundMs?.id === msUser.id) {
      console.log(`  ✓ Found: ${foundMs?.minecraftUsername}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to find by Microsoft ID');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 5: Find by Discord ID
    // ========================================================================
    console.log('Test 5: Find by Discord ID');
    console.log('-'.repeat(40));

    const foundDiscord = await userRepository.findByDiscordId(discordUser.discordId!);

    if (foundDiscord?.id === discordUser.id) {
      console.log(`  ✓ Found: ${foundDiscord?.minecraftUsername}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to find by Discord ID');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 6: Find by email
    // ========================================================================
    console.log('Test 6: Find by email');
    console.log('-'.repeat(40));

    const foundEmail = await userRepository.findByEmail(emailUser.email!);

    if (foundEmail?.id === emailUser.id) {
      console.log(`  ✓ Found: ${foundEmail?.minecraftUsername}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to find by email');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 7: Find by Minecraft username
    // ========================================================================
    console.log('Test 7: Find by Minecraft username');
    console.log('-'.repeat(40));

    const foundMc = await userRepository.findByMinecraftUsername('TestJavaUser');

    if (foundMc?.id === msUser.id) {
      console.log(`  ✓ Found: ${foundMc?.authProvider} user`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to find by Minecraft username');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 8: Update verification status
    // ========================================================================
    console.log('Test 8: Update verification fields');
    console.log('-'.repeat(40));

    const updated = await userRepository.update(msUser.id, {
      verificationAmount: 500,
      verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      verificationStatus: 'pending',
    });

    if (updated.verificationAmount === 500 && updated.verificationExpiresAt) {
      console.log(`  ✓ Verification amount: ${updated.verificationAmount}`);
      console.log(`  ✓ Expires at: ${updated.verificationExpiresAt.toISOString()}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to update verification fields');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // TEST 9: Create auth state with authMethod
    // ========================================================================
    console.log('Test 9: Create auth state with authMethod');
    console.log('-'.repeat(40));

    const stateValue = randomUUID();
    const authState = await authStateRepository.create({
      state: stateValue,
      authMethod: 'microsoft',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    if (authState.authMethod === 'microsoft') {
      console.log(`  ✓ Auth state created: ${authState.state.substring(0, 8)}...`);
      console.log(`  ✓ Auth method: ${authState.authMethod}`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to create auth state with authMethod');
      testsFailed++;
    }

    // Consume it
    const consumed = await authStateRepository.consume(stateValue);
    console.log(`  ✓ Auth state consumed: ${consumed ? 'yes' : 'no'}`);
    console.log();

    // ========================================================================
    // TEST 10: Create session
    // ========================================================================
    console.log('Test 10: Create session');
    console.log('-'.repeat(40));

    const session = await sessionRepository.create({
      userId: msUser.id,
      refreshTokenHash: 'test-hash-' + Date.now(),
      userAgent: 'Test Agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    if (session.id && session.userId === msUser.id) {
      console.log(`  ✓ Session created: ${session.id.substring(0, 8)}...`);
      console.log(`  ✓ User ID: ${session.userId.substring(0, 8)}...`);
      testsPassed++;
    } else {
      console.log('  ✗ Failed to create session');
      testsFailed++;
    }
    console.log();

    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log('Cleaning up test data...');
    console.log('-'.repeat(40));

    await prisma.session.deleteMany({
      where: { userId: { in: [msUser.id, discordUser.id, emailUser.id] } },
    });
    console.log('  ✓ Sessions deleted');

    await prisma.user.deleteMany({
      where: { id: { in: [msUser.id, discordUser.id, emailUser.id] } },
    });
    console.log('  ✓ Test users deleted');
    console.log();

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✓ Passed: ${testsPassed}`);
    console.log(`   ✗ Failed: ${testsFailed}`);
    console.log();

    if (testsFailed === 0) {
      console.log('🎉 All Phase 1 tests passed!\n');
    } else {
      console.log(`⚠️  ${testsFailed} test(s) failed. Please review.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

testRepositories();
