import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { authRateLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/error';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

// Zod schemas for request validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['tenant', 'owner']),
});

const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
});

const verifyOtpSchema = z.object({
  phone: z.string(),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    const { name, phone, email, password, role } = parsed.data;
    const result = await authService.registerUser({
      name,
      phone,
      email,
      passwordHash: password, // passed raw password, will be hashed in service
      role,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    const { phone, password } = parsed.data;
    const { token, user } = await authService.loginUser(phone, password);

    // Set cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(400, 'BAD_REQUEST', parsed.error.errors[0].message));
    }

    const { phone, code } = parsed.data;
    const result = await authService.verifyOtp(phone, code);

    res.status(200).json({
      message: 'Phone number verified successfully. You can now login.',
      user: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// Helper route to get current user details from JWT cookie
import { authenticate } from '../middleware/auth';
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

export default router;
