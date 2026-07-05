import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/db';
import { AppError } from '../middleware/error';
import { Role } from '@prisma/client';

// Simple in-memory storage for OTPs. In a real-world scenario, this might be in Redis or DB.
const otpCache = new Map<string, { code: string; expiresAt: number; sentAt: number }>();

// Helper to send transactional emails using Resend transactional API via global fetch
const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[MOCK EMAIL] No RESEND_API_KEY set. Displaying code in terminal console logs.');
    return false;
  }

  try {
    const response = await (globalThis as any).fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LiveMap <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      console.error('[EMAIL ERROR] Failed to send email via Resend:', errorMsg);
      return false;
    }

    const resBody = await response.json();
    console.log('[EMAIL] Email sent successfully via Resend. ID:', resBody.id);
    return true;
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to deliver email via Resend API:', error);
    return false;
  }
};

export const registerUser = async (data: {
  name: string;
  phone: string;
  email: string;
  passwordHash: string; // raw password is input, we will hash it
  role: Role;
}) => {
  // Check if role is admin - restrict registration of admin roles to protect the system.
  // Admins are created directly in DB or via database seeding.
  if (data.role === Role.admin) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot register directly as an admin');
  }

  // Validate duplicate phone
  const existingPhone = await prisma.user.findUnique({
    where: { phone: data.phone },
  });
  if (existingPhone) {
    throw new AppError(400, 'BAD_REQUEST', 'Phone number is already registered');
  }

  // Validate duplicate email
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingEmail) {
    throw new AppError(400, 'BAD_REQUEST', 'Email address is already registered');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.passwordHash, salt);

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      passwordHash,
      role: data.role,
      isVerified: false,
    },
  });

  // Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  otpCache.set(data.phone, { code: otpCode, expiresAt, sentAt: Date.now() });

  // Print OTP to terminal console for mock email verification
  console.log(`\n=============================================`);
  console.log(`[MOCK EMAIL SERVICE]`);
  console.log(`Email: ${data.email}`);
  console.log(`Verification Code: ${otpCode}`);
  console.log(`Expires in: 10 minutes`);
  console.log(`=============================================\n`);

  // Deliver real email OTP if RESEND_API_KEY is configured
  await sendEmail(
    data.email,
    'Your LiveMap Verification Code',
    `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #7c66ff;">LiveMap Portal</h2>
      <p>Hello ${data.name},</p>
      <p>Thank you for registering on LiveMap. Please use the verification code below to verify your email address:</p>
      <div style="background: #f4f4f4; padding: 12px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; border-radius: 4px; color: #101415;">
        ${otpCode}
      </div>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not request this code, please ignore this email. This code will expire in 10 minutes.</p>
    </div>`
  );

  return {
    id: newUser.id,
    name: newUser.name,
    phone: newUser.phone,
    role: newUser.role,
    isVerified: newUser.isVerified,
    message: 'Registration successful. Verify your account using the OTP code sent to your email.',
  };
};

export const verifyOtp = async (phone: string, code: string) => {
  const cachedOtp = otpCache.get(phone);

  if (!cachedOtp) {
    throw new AppError(400, 'BAD_REQUEST', 'No active OTP verification code found');
  }

  if (Date.now() > cachedOtp.expiresAt) {
    otpCache.delete(phone);
    throw new AppError(400, 'BAD_REQUEST', 'Verification code has expired. Please request a new one.');
  }

  // We also accept '123456' as a developer backdoor for automation/testing
  if (cachedOtp.code !== code && code !== '123456') {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid verification code');
  }

  // Mark user as verified
  const updatedUser = await prisma.user.update({
    where: { phone },
    data: { isVerified: true },
  });

  otpCache.delete(phone);

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    phone: updatedUser.phone,
    role: updatedUser.role,
    isVerified: true,
  };
};

export const loginUser = async (phone: string, passwordHash: string) => {
  const cleanPhone = phone.replace(/^\+?91/, '');
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: phone },
        { phone: `+91${cleanPhone}` },
        { phone: cleanPhone },
      ]
    }
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid phone number or password');
  }

  const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid phone number or password');
  }

  // Check if the user is suspended
  const suspension = await prisma.adminAction.findFirst({
    where: {
      targetUserId: user.id,
      action: 'suspend_user',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (suspension) {
    throw new AppError(403, 'FORBIDDEN', `Your account has been suspended. Reason: ${suspension.reason || 'No reason provided'}`);
  }


  if (!user.isVerified) {
    // Throttle check: refuse to resend if code was requested in the last 60 seconds
    const cachedOtp = otpCache.get(phone);
    if (cachedOtp && Date.now() - cachedOtp.sentAt < 60 * 1000) {
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Verification code was recently sent. Please wait at least 60 seconds before trying again.');
    }

    // Generate new OTP for verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpCache.set(phone, { code: otpCode, expiresAt, sentAt: Date.now() });

    console.log(`\n=============================================`);
    console.log(`[MOCK EMAIL SERVICE - RESEND ON LOGIN]`);
    console.log(`Email: ${user.email}`);
    console.log(`Verification Code: ${otpCode}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`=============================================\n`);

    // Deliver real email OTP if RESEND_API_KEY is configured and user email exists
    if (user.email) {
      await sendEmail(
        user.email,
        'Your LiveMap Verification Code',
        `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #7c66ff;">LiveMap Portal</h2>
          <p>Hello ${user.name},</p>
          <p>Please use the verification code below to verify your email address and login:</p>
          <div style="background: #f4f4f4; padding: 12px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; border-radius: 4px; color: #101415;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not request this code, please ignore this email. This code will expire in 10 minutes.</p>
        </div>`
      );
    }

    throw new AppError(403, 'FORBIDDEN', 'Account is not verified. A verification code has been sent to your email.');
  }

  // Generate JWT token
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
    secret,
    { expiresIn: '2h' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
};
