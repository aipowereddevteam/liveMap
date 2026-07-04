import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/error';

const router = Router();

// Protect all admin routes to Admin role only
router.use(authenticate, requireRole(['admin']));

// Zod validation schemas
const rejectSchema = z.object({
  reason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
});

const suspendSchema = z.object({
  reason: z.string().min(5, 'Suspension reason must be at least 5 characters'),
});

// GET /admin/properties?status=pending (Moderation queue)
router.get('/properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    if (status !== 'pending') {
      return next(new AppError(400, 'BAD_REQUEST', 'Only pending properties can be fetched in the queue'));
    }

    const queue = await adminService.getPendingQueue();
    res.status(200).json(queue);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/properties/:id/approve
router.patch('/properties/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    const result = await adminService.approveProperty(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/properties/:id/reject
router.patch('/properties/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    const result = await adminService.rejectProperty(
      req.user.id,
      req.params.id,
      parsed.data.reason
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/properties/:id/suspend
router.patch('/properties/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    const result = await adminService.suspendProperty(
      req.user.id,
      req.params.id,
      parsed.data.reason
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/users/:id/suspend
router.patch('/users/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    const result = await adminService.suspendUser(
      req.user.id,
      req.params.id,
      parsed.data.reason
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /admin/reports (view reported listings)
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await adminService.getReports();
    res.status(200).json(reports);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/reports/:id/resolve (resolve a report flag)
router.patch('/reports/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.resolveReport(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /admin/analytics (analytics summary)
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await adminService.getAnalytics();
    res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
});

export default router;
