import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  // Log error for internal monitoring (avoid stack trace in production response)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${errorCode}: ${message}`, err.stack);
  }

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
    },
  });
};
