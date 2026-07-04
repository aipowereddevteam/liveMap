import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';

import authRouter from './routes/auth.routes';
import propertyRouter from './routes/property.routes';
import adminRouter from './routes/admin.routes';
import { errorHandler } from './middleware/error';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Setup CORS with credentials support for cookies
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ].filter(Boolean) as string[];

      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Mount Routes
app.use('/auth', authRouter);
app.use('/properties', propertyRouter);
app.use('/admin', adminRouter);

// Centralized Error Handler Middleware (must be registered last)
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

export default app;
