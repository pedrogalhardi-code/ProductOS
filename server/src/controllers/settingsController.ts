import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';

const UpdateSettingsSchema = z.object({
  language: z.string().optional(),
  tone: z.enum(['Formal', 'Startup', 'Technical']).optional(),
  systemPromptPrefix: z.string().max(2000).optional().nullable(),
});

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    let settings = await prisma.userSettings.findUnique({ where: { userId } });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId, language: 'en', tone: 'Formal' },
      });
    }

    res.json({
      data: {
        ...settings,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = UpdateSettingsSchema.parse(req.body);

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: body,
      create: { userId, ...body },
    });

    res.json({
      data: {
        ...settings,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAIUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { period = 'month' } = req.query as { period?: string };

    const now = new Date();
    const startDate = new Date();

    if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setDate(now.getDate() - 1);
    }

    const [totalGenerations, byUser] = await Promise.all([
      prisma.auditLog.count({
        where: {
          action: 'CREATED',
          timestamp: { gte: startDate },
          metadata: { contains: 'documentType' },
        },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          action: 'CREATED',
          timestamp: { gte: startDate },
          metadata: { contains: 'documentType' },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    res.json({
      data: {
        period,
        totalGenerations,
        byUser: byUser.map((u) => ({ userId: u.userId, count: u._count.id })),
        requestingUser: {
          userId,
          generationsThisPeriod: byUser.find((u) => u.userId === userId)?._count.id ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
