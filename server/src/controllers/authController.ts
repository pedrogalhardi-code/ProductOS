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
        // Store hashed password in avatarUrl field temporarily
        // In production, add a passwordHash field to the schema
        avatarUrl: `hash:${passwordHash}`,
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
    if (!user || !user.avatarUrl?.startsWith('hash:')) {
      throw new AppError(401, 'Invalid email or password');
    }

    const passwordHash = user.avatarUrl.replace('hash:', '');
    const valid = await bcrypt.compare(body.password, passwordHash);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    const token = signToken(user.id, user.email);

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: null,
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
