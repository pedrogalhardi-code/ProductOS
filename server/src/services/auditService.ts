import { AuditAction } from '../types/enums';
import { prisma } from './db';
import { logger } from '../middleware/logger';

export async function logAudit(params: {
  userId: string;
  documentId?: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        documentId: params.documentId ?? null,
        action: params.action,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    // Audit failures must never crash the main flow
    logger.error('Failed to write audit log', { error, params });
  }
}

export async function getAuditLogs(filters: {
  documentId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const { documentId, userId, limit = 50, offset = 0 } = filters;

  return prisma.auditLog.findMany({
    where: {
      ...(documentId && { documentId }),
      ...(userId && { userId }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });
}
