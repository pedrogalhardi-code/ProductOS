import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { logAudit } from '../services/auditService';
import { extractTextFromFile } from '../services/fileExtractor';
import { AppError } from '../middleware/errorHandler';
import { AuditAction } from '../types/enums';
import { logger } from '../middleware/logger';

const MAX_REFERENCE_CONTEXT_CHARS = 120_000;

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  clientContext: z.string().min(1, 'Client context is required'),
  referenceContextMaterial: z.string().max(MAX_REFERENCE_CONTEXT_CHARS).optional(),
  driveContextFolderId: z.string().optional().nullable(),
  driveContextFolderName: z.string().max(500).optional().nullable(),
  localContextFolderLabel: z.string().max(500).optional().nullable(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  clientContext: z.string().min(1).optional(),
  referenceContextMaterial: z.string().max(MAX_REFERENCE_CONTEXT_CHARS).optional(),
  driveContextFolderId: z.string().optional().nullable(),
  driveContextFolderName: z.string().max(500).optional().nullable(),
  localContextFolderLabel: z.string().max(500).optional().nullable(),
});

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;

    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        clientContext: true,
        referenceContextLength: true,
        driveContextFolderId: true,
        driveContextFolderName: true,
        localContextFolderLabel: true,
        referenceContextSyncedAt: true,
        createdAt: true,
        updatedAt: true,
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
        referenceContextLength: p.referenceContextLength,
        hasReferenceMaterials: p.referenceContextLength > 0,
        driveContextFolderId: p.driveContextFolderId,
        driveContextFolderName: p.driveContextFolderName,
        localContextFolderLabel: p.localContextFolderLabel,
        referenceContextSyncedAt: p.referenceContextSyncedAt?.toISOString() ?? null,
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
        attachments: {
          select: { id: true, projectId: true, name: true, size: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
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
        referenceContextSyncedAt: project.referenceContextSyncedAt?.toISOString() ?? null,
        hasReferenceMaterials: project.referenceContextLength > 0,
        documentCount: project._count.documents,
        members: project.members.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          user: { ...m.user, createdAt: m.user.createdAt.toISOString() },
        })),
        attachments: project.attachments.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
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
    const ref = (body.referenceContextMaterial ?? '').slice(0, MAX_REFERENCE_CONTEXT_CHARS);
    const hasRef = ref.trim().length > 0;

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        clientContext: body.clientContext,
        referenceContextMaterial: ref,
        referenceContextLength: ref.length,
        driveContextFolderId: body.driveContextFolderId ?? null,
        driveContextFolderName: body.driveContextFolderName ?? null,
        localContextFolderLabel: body.localContextFolderLabel ?? null,
        referenceContextSyncedAt: hasRef ? new Date() : null,
        members: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });

    // Attachments come from multer via multipart/form-data — optional
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const createdAttachments: Array<{ id: string; name: string; size: number }> = [];
    for (const file of files) {
      try {
        const text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
        const attachment = await prisma.projectAttachment.create({
          data: {
            projectId: project.id,
            name: file.originalname,
            size: file.size,
            text: text.slice(0, 200_000), // cap stored text to 200KB
          },
        });
        createdAttachments.push({ id: attachment.id, name: attachment.name, size: attachment.size });
      } catch (err) {
        logger.warn('Failed to extract text from attachment', {
          fileName: file.originalname,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await logAudit({ userId, action: AuditAction.CREATED, metadata: { projectId: project.id, attachmentCount: createdAttachments.length } });

    res.status(201).json({
      data: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        referenceContextSyncedAt: project.referenceContextSyncedAt?.toISOString() ?? null,
        hasReferenceMaterials: project.referenceContextLength > 0,
        attachments: createdAttachments.map((a) => ({
          ...a,
          projectId: project.id,
          createdAt: new Date().toISOString(),
        })),
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

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.clientContext !== undefined) data.clientContext = body.clientContext;
    if (body.driveContextFolderId !== undefined) data.driveContextFolderId = body.driveContextFolderId;
    if (body.driveContextFolderName !== undefined) data.driveContextFolderName = body.driveContextFolderName;
    if (body.localContextFolderLabel !== undefined) data.localContextFolderLabel = body.localContextFolderLabel;
    if (body.referenceContextMaterial !== undefined) {
      const ref = body.referenceContextMaterial.slice(0, MAX_REFERENCE_CONTEXT_CHARS);
      data.referenceContextMaterial = ref;
      data.referenceContextLength = ref.length;
      data.referenceContextSyncedAt = ref.trim().length > 0 ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    const project = await prisma.project.update({
      where: { id },
      data: data as never,
    });

    await logAudit({ userId, action: AuditAction.UPDATED, metadata: { projectId: id } });

    res.json({
      data: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        referenceContextSyncedAt: project.referenceContextSyncedAt?.toISOString() ?? null,
        hasReferenceMaterials: project.referenceContextLength > 0,
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

/** Add additional attachments to an existing project. Multipart request. */
export async function addProjectAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member || member.role === 'VIEWER') {
      throw new AppError(403, 'Insufficient permissions to update this project');
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw new AppError(400, 'No files uploaded');

    const created = [];
    for (const file of files) {
      try {
        const text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
        const attachment = await prisma.projectAttachment.create({
          data: {
            projectId: id,
            name: file.originalname,
            size: file.size,
            text: text.slice(0, 200_000),
          },
          select: { id: true, projectId: true, name: true, size: true, createdAt: true },
        });
        created.push({ ...attachment, createdAt: attachment.createdAt.toISOString() });
      } catch (err) {
        logger.warn('Failed to extract text from attachment', {
          fileName: file.originalname,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await logAudit({
      userId,
      action: AuditAction.UPDATED,
      metadata: { projectId: id, attachmentCount: created.length },
    });

    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

/** Remove a single attachment from a project. */
export async function deleteProjectAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, attachmentId } = req.params;
    const userId = req.userId!;

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member || member.role === 'VIEWER') {
      throw new AppError(403, 'Insufficient permissions to update this project');
    }

    const existing = await prisma.projectAttachment.findFirst({
      where: { id: attachmentId, projectId: id },
    });
    if (!existing) throw new AppError(404, 'Attachment not found');

    await prisma.projectAttachment.delete({ where: { id: attachmentId } });
    await logAudit({
      userId,
      action: AuditAction.UPDATED,
      metadata: { projectId: id, removedAttachmentId: attachmentId },
    });

    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}
