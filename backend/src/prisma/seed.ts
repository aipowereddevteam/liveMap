import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[WARNING] Seeding is blocked in production mode to protect against default credential exploits.');
    return;
  }

  console.log('Seeding database with default users...');

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const ownerPasswordHash = await bcrypt.hash('owner123', 10);
  const tenantPasswordHash = await bcrypt.hash('tenant123', 10);

  // Seed Admin
  const admin = await prisma.user.upsert({
    where: { phone: '+1111111111' },
    update: {},
    create: {
      name: 'Super Admin',
      phone: '+1111111111',
      email: 'admin@rental.com',
      passwordHash: adminPasswordHash,
      role: Role.admin,
      isVerified: true,
    },
  });
  console.log(`Seeded Admin: ${admin.name} (${admin.phone})`);

  // Seed Owner
  const owner = await prisma.user.upsert({
    where: { phone: '+2222222222' },
    update: {},
    create: {
      name: 'John Owner',
      phone: '+2222222222',
      email: 'owner@rental.com',
      passwordHash: ownerPasswordHash,
      role: Role.owner,
      isVerified: true,
    },
  });
  console.log(`Seeded Owner: ${owner.name} (${owner.phone})`);

  // Seed Tenant
  const tenant = await prisma.user.upsert({
    where: { phone: '+3333333333' },
    update: {},
    create: {
      name: 'Jane Tenant',
      phone: '+3333333333',
      email: 'tenant@rental.com',
      passwordHash: tenantPasswordHash,
      role: Role.tenant,
      isVerified: true,
    },
  });
  console.log(`Seeded Tenant: ${tenant.name} (${tenant.phone})`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
