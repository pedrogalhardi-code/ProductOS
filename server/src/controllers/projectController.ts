import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { logAudit } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';
import { AuditAction } from '../types/enums';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  clientContext: z.string().min(10, 'Client context must be at least 10 characters'),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  clientContext: z.string().min(10).optional(),
});

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        _count: { select: { documents: true, members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      data: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        clientContext: p.clientContext,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        documentCount: p._count.documents,
        memberCount: p._count.members,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const project = await prisma.project.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true } } },
        },
        _count: { select: { documents: true } },
      },
    });

    if (!project) throw new AppError(404, 'Project not found');

    res.json({
      data: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        documentCount: project._count.documents,
        members: project.members.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          user: { ...m.user, createdAt: m.user.createdAt.toISOString() },
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = CreateProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        clientContext: body.clientContext,
        members: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });

    await logAudit({ userId, action: AuditAction.CREATED, metadata: { projectId: project.id } });

    res.status(201).json({
      data: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const body = UpdateProjectSchema.parse(req.body);

    // Verify membership
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member || member.role === 'VIEWER') {
      throw new AppError(403, 'Insufficient permissions to update this project');
    }

    const project = await prisma.project.update({
      where: { id },
      data: body,
    });

    await logAudit({ userId, action: AuditAction.UPDATED, metadata: { projectId: id } });

    res.json({
      data: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member || member.role !== 'ADMIN') {
      throw new AppError(403, 'Only project admins can delete projects');
    }

    await prisma.project.delete({ where: { id } });
    await logAudit({ userId, action: AuditAction.DELETED, metadata: { projectId: id } });

    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}
