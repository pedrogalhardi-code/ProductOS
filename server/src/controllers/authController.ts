import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/db';
import { signToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().max(2_000_000).nullable().optional(), // allows data: URLs up to ~2MB
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = RegisterSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        settings: {
          create: {
            language: 'en',
            tone: 'Formal',
          },
        },
      },
    });

    const token = signToken(user.id, user.email);

    res.status(201).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw new AppError(401, 'Invalid email or password');

    // New path: stored passwordHash
    // Legacy path: hash stored in avatarUrl with "hash:" prefix (migration from before passwordHash column existed)
    let passwordHash = user.passwordHash;
    let migratedFromLegacy = false;
    if (!passwordHash && user.avatarUrl?.startsWith('hash:')) {
      passwordHash = user.avatarUrl.slice(5);
      migratedFromLegacy = true;
    }
    if (!passwordHash) throw new AppError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(body.password, passwordHash);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    // Opportunistically migrate legacy users on successful login
    if (migratedFromLegacy) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, avatarUrl: null },
      });
    }

    const token = signToken(user.id, user.email);

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: migratedFromLegacy ? null : user.avatarUrl,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ data: req.user });
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = UpdateProfileSchema.parse(req.body);

    if (body.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== userId) {
        throw new AppError(409, 'Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      },
    });

    res.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
