import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import * as propertyService from '../services/property.service';
import { authenticate, requireRole, UserPayload } from '../middleware/auth';
import { enquiryRateLimiter } from '../middleware/rateLimiter';
import { upload } from '../config/cloudinary';
import { AppError } from '../middleware/error';
import { PropertyType } from '@prisma/client';

const router = Router();

// Middleware for optional authentication (to allow owner/admin to view non-approved detail pages)
const authenticateOptional = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
    const decoded = jwt.verify(token, secret) as UserPayload;
    req.user = decoded;
  } catch (error) {
    // Ignore invalid token and treat as guest
  }
  next();
};

// Zod validation schemas
const searchSchema = z.object({
  lat: z.string().transform((val) => parseFloat(val)),
  lng: z.string().transform((val) => parseFloat(val)),
  radiusKm: z.string().transform((val) => parseFloat(val)),
  type: z.enum(['room', 'flat', 'pg', 'house'] as const).optional(),
  minRent: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  maxRent: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
});

const createPropertySchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  type: z.enum(['room', 'flat', 'pg', 'house'] as const),
  rent: z.preprocess((val) => parseFloat(val as string), z.number().positive('Rent must be positive')),
  deposit: z.preprocess((val) => parseFloat(val as string), z.number().nonnegative('Deposit must be non-negative')),
  latitude: z.preprocess((val) => parseFloat(val as string), z.number().min(-90).max(90)),
  longitude: z.preprocess((val) => parseFloat(val as string), z.number().min(-180).max(180)),
  address: z.string().min(5, 'Address is too short'),
  landmarks: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string())),
  amenities: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string())),
  photos: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string()).max(6, 'Maximum 6 photos allowed per listing')).optional(),
});

const reportSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

// GET /properties (public search / owner listings)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // If the owner is requesting their own listings
    if (req.query.myListings === 'true') {
      const token = req.cookies?.token;
      if (!token) {
        return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required to view your listings'));
      }
      
      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
      const decoded = jwt.verify(token, secret) as UserPayload;

      const myListings = await propertyService.getPropertiesByOwnerId(decoded.id);
      return res.status(200).json(myListings);
    }

    const parsedQuery = searchSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return next(new AppError(400, 'BAD_REQUEST', 'Missing or invalid search query parameters (lat, lng, radiusKm required)'));
    }

    const properties = await propertyService.searchProperties(parsedQuery.data);
    res.status(200).json(properties);
  } catch (error) {
    next(error);
  }
});


// POST /properties/upload (owner - upload image files)
router.post(
  '/upload',
  authenticate,
  requireRole(['owner', 'admin']),
  upload.array('photos', 6),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return next(new AppError(400, 'BAD_REQUEST', 'No photos uploaded'));
      }

      // files.map((file) => file.path) returns the full Cloudinary URL
      const urls = files.map((file) => file.path);
      res.status(200).json({ urls });
    } catch (error) {
      next(error);
    }
  }
);

// POST /properties (owner - create listing)
router.post(
  '/',
  authenticate,
  requireRole(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createPropertySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
      }

      if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));

      const result = await propertyService.createProperty(req.user.id, {
        ...parsed.data,
        photos: parsed.data.photos || [],
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /properties/:id (public - get single details with incremented view)
router.get('/:id', authenticateOptional, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await propertyService.getPropertyById(
      req.params.id,
      req.user?.id,
      req.user?.role
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /properties/:id (owner - edit listing)
router.patch(
  '/:id',
  authenticate,
  requireRole(['owner']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createPropertySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
      }

      if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));

      const result = await propertyService.updateProperty(
        req.user.id,
        req.params.id,
        parsed.data
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /properties/:id (owner own / admin any)
router.delete(
  '/:id',
  authenticate,
  requireRole(['owner', 'admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));

      const result = await propertyService.deleteProperty(
        req.user.id,
        req.user.role,
        req.params.id
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /properties/:id/enquiry (tenant - contact owner, rate-limited)
router.post(
  '/:id/enquiry',
  authenticate,
  requireRole(['tenant']),
  enquiryRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));

      const result = await propertyService.createEnquiry(req.user.id, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /properties/:id/report (tenant - report listing)
router.post(
  '/:id/report',
  authenticate,
  requireRole(['tenant']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
      }

      if (!req.user) return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));

      const result = await propertyService.createReport(
        req.user.id,
        req.params.id,
        parsed.data.reason
      );

      res.status(201).json({
        message: 'Report submitted successfully. Admin will review the listing.',
        reportId: result.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
