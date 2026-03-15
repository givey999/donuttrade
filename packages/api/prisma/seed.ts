import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPAWNERS = [
  { name: 'zombie_spawner', displayName: 'Zombie Spawner' },
  { name: 'skeleton_spawner', displayName: 'Skeleton Spawner' },
  { name: 'blaze_spawner', displayName: 'Blaze Spawner' },
  { name: 'spider_spawner', displayName: 'Spider Spawner' },
  { name: 'cave_spider_spawner', displayName: 'Cave Spider Spawner' },
  { name: 'creeper_spawner', displayName: 'Creeper Spawner' },
  { name: 'enderman_spawner', displayName: 'Enderman Spawner' },
  { name: 'iron_golem_spawner', displayName: 'Iron Golem Spawner' },
  { name: 'silverfish_spawner', displayName: 'Silverfish Spawner' },
  { name: 'magma_cube_spawner', displayName: 'Magma Cube Spawner' },
];

async function main() {
  console.log('Seeding catalog items...');

  for (const spawner of SPAWNERS) {
    await prisma.catalogItem.upsert({
      where: { name: spawner.name },
      update: { displayName: spawner.displayName },
      create: {
        name: spawner.name,
        displayName: spawner.displayName,
        category: 'spawner',
      },
    });
  }

  console.log(`Seeded ${SPAWNERS.length} catalog items.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
