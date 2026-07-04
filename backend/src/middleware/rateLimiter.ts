import rateLimit from 'express-rate-limit';

// Rate limiter for authentication routes (login, register, OTP verification)
// Limit to 10 requests per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

// Rate limiter for making inquiries (revealing owner contact info)
// Limit to 5 enquiries per hour per IP/user
export const enquiryRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Enquiry limit reached. Please wait an hour before contacting more owners.',
    },
  },
});
