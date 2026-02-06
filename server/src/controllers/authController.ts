import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

// ============================================================
// Validation Schemas
// ============================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().optional(),
  language: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
  language: z.string().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters'),
});

// ============================================================
// Helpers
// ============================================================

function generateToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

function sanitizeUser(user: {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl: string | null;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    avatarUrl: user.avatarUrl,
    language: user.language,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ============================================================
// Controllers
// ============================================================

/**
 * POST /auth/register
 * Create a new user account and return a JWT token.
 */
export const register = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError(errors, 400);
    }

    const { email, password, firstName, lastName, phone, language } = parsed.data;

    // Check if a user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('A user with this email already exists', 409);
    }

    // Check phone uniqueness when provided
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        throw new AppError('A user with this phone number already exists', 409);
      }
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        language: language || 'en',
      },
    });

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
      },
      message: 'Registration successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login
 * Validate credentials and return a JWT token with user info.
 */
export const login = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError(errors, 400);
    }

    const { email, password } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if the account is active
    if (!user.isActive) {
      throw new AppError('Account has been deactivated', 403);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/profile
 * Return the current authenticated user's profile.
 */
export const getProfile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { devoteeProfile: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        ...sanitizeUser(user),
        devoteeProfile: user.devoteeProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /auth/profile
 * Update the current authenticated user's profile fields.
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError(errors, 400);
    }

    const updateData = parsed.data;

    // If phone is being updated, check uniqueness
    if (updateData.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: updateData.phone },
      });
      if (existingPhone && existingPhone.id !== req.user.userId) {
        throw new AppError('A user with this phone number already exists', 409);
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: sanitizeUser(user),
      message: 'Profile updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /auth/change-password
 * Change the current user's password after verifying the old password.
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError(errors, 400);
    }

    const { oldPassword, newPassword } = parsed.data;

    // Fetch user with current password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Prevent reusing the same password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    // Hash and save the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { passwordHash },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
