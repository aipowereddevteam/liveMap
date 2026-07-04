import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error';

export interface UserPayload {
  id: string;
  name: string;
  phone: string;
  role: 'tenant' | 'owner' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'No authentication token provided'));
  }

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
    const decoded = jwt.verify(token, secret) as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token'));
  }
};

export const requireRole = (allowedRoles: ('tenant' | 'owner' | 'admin')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Access denied. Role ${req.user.role} does not have permission.`
        )
      );
    }

    next();
  };
};
