import { prisma } from '../utils/db';
import { AppError } from '../middleware/error';
import { PropertyType, PropertyStatus, ReportStatus, Prisma } from '@prisma/client';

export interface CreatePropertyInput {
  title: string;
  description: string;
  type: PropertyType;
  rent: number;
  deposit: number;
  latitude: number;
  longitude: number;
  address: string;
  landmarks: string[];
  amenities: string[];
  photos: string[]; // URLs of photos
}

export const createProperty = async (ownerId: string, input: CreatePropertyInput) => {
  // Enforce status to 'pending' server-side
  const newProperty = await prisma.property.create({
    data: {
      ownerId,
      title: input.title,
      description: input.description,
      type: input.type,
      rent: new Prisma.Decimal(input.rent),
      deposit: new Prisma.Decimal(input.deposit),
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      landmarks: input.landmarks,
      amenities: input.amenities,
      status: PropertyStatus.pending,
    },
  });

  // Create photos
  if (input.photos && input.photos.length > 0) {
    await prisma.propertyPhoto.createMany({
      data: input.photos.map((url, index) => ({
        propertyId: newProperty.id,
        url,
        sortOrder: index,
      })),
    });
  }

  return getPropertyById(newProperty.id, ownerId, 'owner');
};

export const updateProperty = async (
  ownerId: string,
  propertyId: string,
  input: Partial<CreatePropertyInput>
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Ensure caller is the owner
  if (property.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this property');
  }

  // If status is updated, force it back to pending unless edited by admin (admin updates go via admin service)
  const updateData: any = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.rent !== undefined) updateData.rent = new Prisma.Decimal(input.rent);
  if (input.deposit !== undefined) updateData.deposit = new Prisma.Decimal(input.deposit);
  if (input.latitude !== undefined) updateData.latitude = input.latitude;
  if (input.longitude !== undefined) updateData.longitude = input.longitude;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.landmarks !== undefined) updateData.landmarks = input.landmarks;
  if (input.amenities !== undefined) updateData.amenities = input.amenities;
  
  // Forced to pending status on edit
  updateData.status = PropertyStatus.pending;
  updateData.rejectionReason = null; // Clear rejection reason on edit

  await prisma.property.update({
    where: { id: propertyId },
    data: updateData,
  });

  // Update photos if provided
  if (input.photos !== undefined) {
    // Delete existing photos and recreate
    await prisma.propertyPhoto.deleteMany({
      where: { propertyId },
    });
    if (input.photos.length > 0) {
      await prisma.propertyPhoto.createMany({
        data: input.photos.map((url, index) => ({
          propertyId,
          url,
          sortOrder: index,
        })),
      });
    }
  }

  return getPropertyById(propertyId, ownerId, 'owner');
};

export const deleteProperty = async (userId: string, userRole: string, propertyId: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Admin can delete any property; Owner can delete only their own property
  if (userRole !== 'admin' && property.ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this property');
  }

  await prisma.property.delete({
    where: { id: propertyId },
  });

  return { success: true, message: 'Property listing deleted successfully' };
};

export const getPropertyById = async (propertyId: string, userId?: string, userRole?: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      photos: {
        orderBy: { sortOrder: 'asc' },
      },
      owner: {
        select: {
          id: true,
          name: true,
          // Do not leak phone number unless requested via Enquiry flow
        },
      },
    },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Gate check: only allow viewing approved properties, unless user is owner or admin
  const isOwner = userId && property.ownerId === userId;
  const isAdmin = userRole === 'admin';

  if (property.status !== PropertyStatus.approved && !isOwner && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this property listing');
  }

  // Increment viewCount
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      viewCount: { increment: 1 },
    },
  });

  // Return incremented viewCount (add 1 manually to local object to save a DB query response lag)
  property.viewCount += 1;

  return property;
};

export const searchProperties = async (filters: {
  lat: number;
  lng: number;
  radiusKm: number;
  type?: PropertyType;
  minRent?: number;
  maxRent?: number;
}) => {
  const { lat, lng, radiusKm, type, minRent, maxRent } = filters;

  let properties: any[] = [];
  try {
    // Exact raw geospatial query from Dev Spec section 4
    properties = await prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p."ownerId",
        p.title,
        p.description,
        p.type,
        p.rent::text,
        p.deposit::text,
        p.latitude,
        p.longitude,
        p.address,
        p.landmarks,
        p.amenities,
        p.status,
        p."viewCount",
        p."createdAt",
        p."updatedAt",
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance_m
      FROM "Property" p
      WHERE p.status = 'approved'
        AND ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusKm * 1000}
        )
        AND (${type || null}::text IS NULL OR p.type::text = ${type || null})
        AND (${minRent !== undefined ? minRent : null}::numeric IS NULL OR p.rent >= ${minRent !== undefined ? minRent : null}::numeric)
        AND (${maxRent !== undefined ? maxRent : null}::numeric IS NULL OR p.rent <= ${maxRent !== undefined ? maxRent : null}::numeric)
      ORDER BY distance_m ASC
      LIMIT 50;
    `;
  } catch (error: any) {
    console.warn('[GEOSPATIAL] PostGIS search failed or is not available. Falling back to trigonometric Haversine calculations.');
    // Haversine formula fallback for local database without PostGIS extension
    properties = await prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p."ownerId",
        p.title,
        p.description,
        p.type,
        p.rent::text,
        p.deposit::text,
        p.latitude,
        p.longitude,
        p.address,
        p.landmarks,
        p.amenities,
        p.status,
        p."viewCount",
        p."createdAt",
        p."updatedAt",
        (6371000 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            SIN(radians(${lat})) * SIN(radians(p.latitude)) +
            COS(radians(${lat})) * COS(radians(p.latitude)) * COS(radians(p.longitude) - radians(${lng}))
          ))
        )) AS distance_m
      FROM "Property" p
      WHERE p.status = 'approved'
        AND (6371000 * ACOS(
          LEAST(1.0, GREATEST(-1.0,
            SIN(radians(${lat})) * SIN(radians(p.latitude)) +
            COS(radians(${lat})) * COS(radians(p.latitude)) * COS(radians(p.longitude) - radians(${lng}))
          ))
        )) <= ${radiusKm * 1000}
        AND (${type || null}::text IS NULL OR p.type::text = ${type || null})
        AND (${minRent !== undefined ? minRent : null}::numeric IS NULL OR p.rent >= ${minRent !== undefined ? minRent : null}::numeric)
        AND (${maxRent !== undefined ? maxRent : null}::numeric IS NULL OR p.rent <= ${maxRent !== undefined ? maxRent : null}::numeric)
      ORDER BY distance_m ASC
      LIMIT 50;
    `;
  }

  if (properties.length === 0) {
    return [];
  }

  // Fetch photos for all properties returned
  const propertyIds = properties.map((p) => p.id);
  const photos = await prisma.propertyPhoto.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: { sortOrder: 'asc' },
  });

  // Group photos by propertyId
  const photoMap = photos.reduce((acc: any, photo) => {
    if (!acc[photo.propertyId]) {
      acc[photo.propertyId] = [];
    }
    acc[photo.propertyId].push(photo);
    return acc;
  }, {});

  // Append photos and convert rents to numeric format
  return properties.map((p) => ({
    ...p,
    rent: parseFloat(p.rent),
    deposit: parseFloat(p.deposit),
    distance_m: parseFloat(p.distance_m),
    photos: photoMap[p.id] || [],
  }));
};

export const createEnquiry = async (tenantId: string, propertyId: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Ensure property is approved before enquiry
  if (property.status !== PropertyStatus.approved) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot contact owner for unapproved listing');
  }

  // Create Enquiry log (critical monetization event log)
  await prisma.enquiry.create({
    data: {
      propertyId,
      tenantId,
      contactRevealedAt: new Date(),
    },
  });

  // Return the owner's details, revealing their phone number
  return {
    ownerName: property.owner.name,
    ownerPhone: property.owner.phone,
  };
};

export const createReport = async (reportedBy: string, propertyId: string, reason: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const report = await prisma.report.create({
    data: {
      propertyId,
      reportedBy,
      reason,
      status: ReportStatus.open,
    },
  });

  return report;
};

export const getPropertiesByOwnerId = async (ownerId: string) => {
  return prisma.property.findMany({
    where: { ownerId },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      enquiries: {
        include: {
          tenant: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

