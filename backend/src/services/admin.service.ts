import { prisma } from '../utils/db';
import { AppError } from '../middleware/error';
import { PropertyStatus, ReportStatus } from '@prisma/client';

export const getPendingQueue = async () => {
  return prisma.property.findMany({
    where: { status: PropertyStatus.pending },
    include: {
      photos: true,
      owner: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const approveProperty = async (adminId: string, propertyId: string) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Update property status
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: PropertyStatus.approved,
      rejectionReason: null,
    },
  });

  // Log audit action
  await prisma.adminAction.create({
    data: {
      adminId,
      propertyId,
      action: 'approve',
      reason: 'Approved by admin',
    },
  });

  return { success: true, message: 'Property approved successfully' };
};

export const rejectProperty = async (adminId: string, propertyId: string, reason: string) => {
  if (!reason || reason.trim() === '') {
    throw new AppError(400, 'BAD_REQUEST', 'Rejection reason is required');
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Update property status and reason
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: PropertyStatus.rejected,
      rejectionReason: reason,
    },
  });

  // Log audit action
  await prisma.adminAction.create({
    data: {
      adminId,
      propertyId,
      action: 'reject',
      reason,
    },
  });

  return { success: true, message: 'Property rejected successfully' };
};

export const suspendProperty = async (adminId: string, propertyId: string, reason: string) => {
  if (!reason || reason.trim() === '') {
    throw new AppError(400, 'BAD_REQUEST', 'Suspension reason is required');
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  // Update property status
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: PropertyStatus.suspended,
    },
  });

  // Log audit action
  await prisma.adminAction.create({
    data: {
      adminId,
      propertyId,
      action: 'suspend_listing',
      reason,
    },
  });

  return { success: true, message: 'Property listing suspended' };
};

export const suspendUser = async (adminId: string, userId: string, reason: string) => {
  if (!reason || reason.trim() === '') {
    throw new AppError(400, 'BAD_REQUEST', 'Reason for user suspension is required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (user.role === 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Cannot suspend an admin user');
  }

  // Log audit action for suspension
  await prisma.adminAction.create({
    data: {
      adminId,
      targetUserId: userId,
      action: 'suspend_user',
      reason,
    },
  });

  // Optional: Update all property listings of the suspended user to suspended status
  await prisma.property.updateMany({
    where: { ownerId: userId },
    data: { status: PropertyStatus.suspended },
  });

  return { success: true, message: 'User suspended successfully' };
};

export const getReports = async () => {
  return prisma.report.findMany({
    include: {
      property: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const resolveReport = async (reportId: string) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: ReportStatus.resolved,
      resolvedAt: new Date(),
    },
  });

  return { success: true, message: 'Report resolved' };
};

export const getAnalytics = async () => {
  const totalProperties = await prisma.property.count();
  const approvedProperties = await prisma.property.count({
    where: { status: PropertyStatus.approved },
  });
  const pendingProperties = await prisma.property.count({
    where: { status: PropertyStatus.pending },
  });

  const totalLeads = await prisma.enquiry.count();

  // DAU: Count unique users active in the last 24 hours.
  // We check: users created in last 24h, enquiries created in last 24h, and admin actions in last 24h.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const activeRegistrations = await prisma.user.findMany({
    where: { createdAt: { gte: oneDayAgo } },
    select: { id: true },
  });

  const activeEnquirers = await prisma.enquiry.findMany({
    where: { createdAt: { gte: oneDayAgo } },
    select: { tenantId: true },
  });

  const activeAdmins = await prisma.adminAction.findMany({
    where: { createdAt: { gte: oneDayAgo } },
    select: { adminId: true },
  });

  // Calculate unique user IDs active
  const activeUserIds = new Set<string>();
  activeRegistrations.forEach((u) => activeUserIds.add(u.id));
  activeEnquirers.forEach((e) => activeUserIds.add(e.tenantId));
  activeAdmins.forEach((a) => activeUserIds.add(a.adminId));

  // If set is empty, return at least 1 if an admin is querying (since the admin is currently active!)
  const dau = Math.max(activeUserIds.size, 1);

  return {
    listingCount: totalProperties,
    approvedListingCount: approvedProperties,
    pendingListingCount: pendingProperties,
    leadCount: totalLeads,
    dau,
  };
};
