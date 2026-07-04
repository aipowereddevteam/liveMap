import request from 'supertest';
import app from '../index';
import { prisma } from '../utils/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, PropertyStatus } from '@prisma/client';

describe('Rental Marketplace Integration Tests', () => {
  let adminToken: string;
  let ownerToken: string;
  let tenantToken: string;
  
  let ownerId: string;
  let tenantId: string;
  let adminId: string;

  beforeAll(async () => {
    // Clear test tables to keep test run clean and reproducible
    await prisma.adminAction.deleteMany({});
    await prisma.report.deleteMany({});
    await prisma.enquiry.deleteMany({});
    await prisma.propertyPhoto.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.user.deleteMany({});

    const passwordHash = await bcrypt.hash('password123', 10);
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

    // Create test admin
    const adminUser = await prisma.user.create({
      data: {
        name: 'Test Admin',
        phone: '+9999999999',
        passwordHash,
        role: Role.admin,
        isVerified: true,
      },
    });
    adminId = adminUser.id;
    adminToken = jwt.sign({ id: adminUser.id, role: adminUser.role, name: adminUser.name, phone: adminUser.phone }, secret);

    // Create test owner
    const ownerUser = await prisma.user.create({
      data: {
        name: 'Test Owner',
        phone: '+8888888888',
        passwordHash,
        role: Role.owner,
        isVerified: true,
      },
    });
    ownerId = ownerUser.id;
    ownerToken = jwt.sign({ id: ownerUser.id, role: ownerUser.role, name: ownerUser.name, phone: ownerUser.phone }, secret);

    // Create test tenant
    const tenantUser = await prisma.user.create({
      data: {
        name: 'Test Tenant',
        phone: '+7777777777',
        passwordHash,
        role: Role.tenant,
        isVerified: true,
      },
    });
    tenantId = tenantUser.id;
    tenantToken = jwt.sign({ id: tenantUser.id, role: tenantUser.role, name: tenantUser.name, phone: tenantUser.phone }, secret);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Role Enforcement Tests', () => {
    it('should block tenant token from accessing owner property creation (returns 403)', async () => {
      const response = await request(app)
        .post('/properties')
        .set('Cookie', [`token=${tenantToken}`])
        .send({
          title: 'Premium Studio Flat',
          description: 'Beautiful studio flat near tech park.',
          type: 'flat',
          rent: 15000,
          deposit: 30000,
          latitude: 12.9716,
          longitude: 77.5946,
          address: 'MG Road, Bangalore',
          landmarks: ['Metro Station'],
          amenities: ['AC', 'Wifi'],
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow owner to create a property with status forced to pending (returns 201)', async () => {
      const response = await request(app)
        .post('/properties')
        .set('Cookie', [`token=${ownerToken}`])
        .send({
          title: 'Cozy Room for Rent',
          description: 'A cozy single room available for students.',
          type: 'room',
          rent: 8000,
          deposit: 16000,
          latitude: 12.9716,
          longitude: 77.5946,
          address: 'Indiranagar, Bangalore',
          landmarks: ['Corner House'],
          amenities: ['Bed', 'Geyser'],
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(PropertyStatus.pending);
      expect(response.body.ownerId).toBe(ownerId);
    });

    it('should block owner from modifying another owner\'s property (returns 403)', async () => {
      // Create a property owned by owner
      const p = await prisma.property.create({
        data: {
          ownerId: ownerId,
          title: 'Owner Property',
          description: 'Owner description goes here.',
          type: 'flat',
          rent: 10000,
          deposit: 20000,
          latitude: 12.9716,
          longitude: 77.5946,
          address: 'Test Address',
          status: PropertyStatus.pending,
        },
      });

      // Another owner tries to modify it
      const anotherOwnerToken = jwt.sign(
        { id: 'another-owner-id', role: Role.owner, name: 'Another', phone: '+1234567890' },
        process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production'
      );

      const response = await request(app)
        .patch(`/properties/${p.id}`)
        .set('Cookie', [`token=${anotherOwnerToken}`])
        .send({
          title: 'Hacked Title',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Geospatial Radius Search Tests', () => {
    let pCloseId: string;
    let pFarId: string;

    beforeAll(async () => {
      // Center Point is MG Road Bangalore: 12.9716, 77.5946

      // 1. Close Property: ~4.9 km north of center (Lat: 12.9716 + 0.0441, Lng: 77.5946)
      const pClose = await prisma.property.create({
        data: {
          ownerId: ownerId,
          title: 'Close Property (4.9km)',
          description: 'This listing is inside the search radius.',
          type: 'flat',
          rent: 12000,
          deposit: 24000,
          latitude: 12.9716 + 0.0441,
          longitude: 77.5946,
          address: 'Hebbal, Bangalore',
          status: PropertyStatus.approved, // Must be approved to appear in search
        },
      });
      pCloseId = pClose.id;

      // 2. Far Property: ~5.1 km north of center (Lat: 12.9716 + 0.0459, Lng: 77.5946)
      const pFar = await prisma.property.create({
        data: {
          ownerId: ownerId,
          title: 'Far Property (5.1km)',
          description: 'This listing is outside the search radius.',
          type: 'flat',
          rent: 13000,
          deposit: 26000,
          latitude: 12.9716 + 0.0459,
          longitude: 77.5946,
          address: 'Yelahanka Entrance, Bangalore',
          status: PropertyStatus.approved, // Must be approved to appear in search
        },
      });
      pFarId = pFar.id;

      // Force trigger calculation sync for test (if database trigger is not run automatically by SQLite/Memory DBs,
      // but since we run on Postgres with PostGIS, the trigger trg_sync_property_location will execute on INSERT.
      // Let's run a manual update to trigger synchronization to location geography columns)
      await prisma.$executeRaw`
        UPDATE "Property"
        SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;
      `;
    });

    it('should find close property (4.9km) but filter out far property (5.1km) in 5km search radius', async () => {
      const response = await request(app)
        .get('/properties')
        .query({
          lat: 12.9716,
          lng: 77.5946,
          radiusKm: 5,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const ids = response.body.map((p: any) => p.id);
      expect(ids).toContain(pCloseId);
      expect(ids).not.toContain(pFarId);
    });

    it('should return both properties when search radius is expanded to 10km', async () => {
      const response = await request(app)
        .get('/properties')
        .query({
          lat: 12.9716,
          lng: 77.5946,
          radiusKm: 10,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const ids = response.body.map((p: any) => p.id);
      expect(ids).toContain(pCloseId);
      expect(ids).toContain(pFarId);
    });
  });
});
