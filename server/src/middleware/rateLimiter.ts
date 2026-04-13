import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '3600000', 10); // 1 hour
const maxAIRequests = parseInt(process.env.RATE_LIMIT_AI_REQUESTS_PER_HOUR ?? '20', 10);

/** Rate limiter for AI generation endpoints — 20 requests per user per hour */
export const aiRateLimiter = rateLimit({
  windowMs,
  max: maxAIRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'anonymous',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: `AI generation rate limit exceeded. Maximum ${maxAIRequests} requests per hour.`,
      retryAfter: Math.ceil(windowMs / 1000),
    });
  },
  message: `Too many AI generation requests. Please wait before trying again.`,
});

/** General API rate limiter */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'anonymous',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});
