import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|::1/.test(dbUrl);
  const bypass = process.env.BYPASS_SEED_GUARD === 'true';

  if (!isLocal && !bypass) {
    console.error('\n=============================================================');
    console.error('⚠️  [CRITICAL ERROR] Database Seeding Blocked!');
    console.error('Seeding is only permitted on local databases (localhost/127.0.0.1).');
    console.error('DATABASE_URL connection host is not recognized as a local host.');
    console.error('To override this block for manual cloud seeding, run the script with:');
    console.error('BYPASS_SEED_GUARD=true');
    console.error('=============================================================\n');
    process.exit(1);
  }

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

  // Seed 20 test properties around Navrangpura, Ahmedabad for geolocation testing
  const propertyCount = await prisma.property.count();
  if (propertyCount === 0) {
    console.log('Seeding 20 test properties around Navrangpura, Ahmedabad...');

    const centerLat = 23.0355;
    const centerLng = 72.5647;

    // Seed 10 properties within 5km (offset ~ 0.01 to 0.035)
    for (let i = 1; i <= 10; i++) {
      const angle = (i * 2 * Math.PI) / 10;
      const radiusOffset = 0.01 + (i * 0.0025); // distribute inside 5km
      const lat = centerLat + Math.sin(angle) * radiusOffset;
      const lng = centerLng + Math.cos(angle) * radiusOffset;

      const propType = i % 2 === 0 ? 'flat' : 'room';

      await prisma.property.create({
        data: {
          ownerId: owner.id,
          title: `Within 5km Group #${i} - ${propType.toUpperCase()} near Radhe Residency`,
          description: `This is test property #${i} located within 5km from Navrangpura Center. It features a spacious layout, great natural lighting, and modern fixtures. Managed directly by the owner with zero broker commissions.`,
          type: propType as any,
          rent: 7500 + i * 250,
          deposit: 15000 + i * 500,
          latitude: lat,
          longitude: lng,
          address: `Apartment 10${i}, Radhe Residency, Navrangpura, Ahmedabad, Gujarat 380009`,
          landmarks: ['Radhe Residency', 'Navrangpura Center', 'Gujarat University'],
          amenities: ['Wifi', 'Water Supply', 'AC', 'Elevator'],
          status: 'approved',
        },
      });
    }

    // Seed 10 properties between 5km and 10km (offset ~ 0.05 to 0.08)
    for (let i = 11; i <= 20; i++) {
      const angle = (i * 2 * Math.PI) / 10;
      const radiusOffset = 0.05 + ((i - 10) * 0.0035); // distribute between 5km and 10km
      const lat = centerLat + Math.sin(angle) * radiusOffset;
      const lng = centerLng + Math.cos(angle) * radiusOffset;

      const propType = i % 2 === 0 ? 'flat' : 'room';

      await prisma.property.create({
        data: {
          ownerId: owner.id,
          title: `5-10km Group #${i} - ${propType.toUpperCase()} near Ahmedabad SG Highway`,
          description: `This is test property #${i} located exactly between 5km and 10km from Navrangpura Center. It is situated in a premium residential locality with proximity to schools, hospitals, and markets.`,
          type: propType as any,
          rent: 9000 + i * 150,
          deposit: 18000 + i * 300,
          latitude: lat,
          longitude: lng,
          address: `House ${i * 3}, SG Highway, Ahmedabad, Gujarat 380015`,
          landmarks: ['SG Highway', 'ISCON Mall', 'Sola Flyover'],
          amenities: ['Power Backup', 'Geyser', 'CCTV Security', 'Parking Space'],
          status: 'approved',
        },
      });
    }

    console.log('Seeded 20 test properties successfully!');
  }

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
