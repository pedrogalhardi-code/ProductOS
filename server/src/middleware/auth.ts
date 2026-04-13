import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db';
import { logger } from './logger';

interface JWTPayload {
  sub: string; // userId
  email: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      logger.error('JWT_SECRET is not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const payload = jwt.verify(token, secret) as JWTPayload;

    // Fetch user from DB to ensure they still exist and get fresh role
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      avatarUrl: user.avatarUrl ?? null,
    };
    req.userId = user.id;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      logger.error('Auth middleware error', { error });
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Required role: ${roles.join(' or ')}`,
      });
      return;
    }

    next();
  };
}

/** Sign a JWT token for a user (used in /auth/login) */
export function signToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  return jwt.sign({ sub: userId, email }, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}
