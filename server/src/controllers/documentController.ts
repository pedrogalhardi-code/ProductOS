import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { logAudit } from '../services/auditService';
import { streamDocumentGeneration, streamCPOReview } from '../services/aiService';
import { buildFullClientContext } from '../services/projectContext';
import { AppError } from '../middleware/errorHandler';
import { AuditAction, DocumentType, DocumentStatus } from '../types/enums';

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.enum(['PRD', 'USER_STORIES', 'TECHNICAL_SPEC', 'PRODUCT_BRIEF', 'ROADMAP', 'OKRS']),
  projectId: z.string().cuid(),
  content: z.string().optional(),
});

const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED']).optional(),
  content: z.string().optional(),
  figmaFileUrl: z.string().url().optional().nullable(),
  figmaFileName: z.string().optional().nullable(),
  jiraEpicKey: z.string().optional().nullable(),
});

const RICH_REFERENCE_MIN_CHARS = 200;

const GenerateSchema = z.object({
  projectId: z.string().cuid(),
  documentType: z.enum(['PRD', 'USER_STORIES', 'TECHNICAL_SPEC', 'PRODUCT_BRIEF', 'ROADMAP', 'OKRS']),
  input: z.string().max(500_000),
  inputType: z.enum(['idea', 'notes', 'form', 'url']),
  language: z.string().optional(),
  tone: z.enum(['Formal', 'Startup', 'Technical']).optional(),
});

function resolveGenerationInput(
  rawInput: string,
  documentType: DocumentType,
  referenceContextLength: number
): string {
  const trimmed = rawInput.trim();
  const refLen = referenceContextLength ?? 0;
  const hasRichReference = refLen >= RICH_REFERENCE_MIN_CHARS;

  if (trimmed.length >= 5) return trimmed;

  if (hasRichReference) {
    const base =
      'No separate author notes for this run. Use the project client context and synced reference materials (folder/Drive) as the primary sources. ' +
      `Document type: ${documentType}. Produce the complete requested document; follow system instructions on assumptions and when to ask questions.`;
    if (trimmed.length === 0) return base;
    return `Author focus: ${trimmed}\n\n${base}`;
  }

  throw new AppError(
    400,
    'Add at least 5 characters of idea, notes, or form content—or sync folder/Drive reference materials (about 200+ characters of text) so the model can draft from the project alone.'
  );
}

/** Helper: verify user has access to a document's project */
async function assertDocumentAccess(documentId: string, userId: string) {
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      project: { members: { some: { userId } } },
    },
    include: {
      project: true,
      author: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true } },
    },
  });
  if (!doc) throw new AppError(404, 'Document not found');
  return doc;
}

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { projectId, type, status, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const size = Math.min(100, parseInt(pageSize, 10));

    const where = {
      project: { members: { some: { userId } } },
      ...(projectId && { projectId }),
      ...(type && { type: type as DocumentType }),
      ...(status && { status: status as DocumentStatus }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      }),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true } },
          project: { select: { id: true, name: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      data: documents.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        versionCount: d._count.versions,
        author: { ...d.author, createdAt: d.author.createdAt.toISOString() },
      })),
      total,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const doc = await assertDocumentAccess(req.params.id, req.userId!);

    res.json({
      data: {
        ...doc,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        author: { ...doc.author, createdAt: doc.author.createdAt.toISOString() },
        project: {
          ...doc.project,
          createdAt: doc.project.createdAt.toISOString(),
          updatedAt: doc.project.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = CreateDocumentSchema.parse(req.body);

    // Verify project membership
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: body.projectId, userId } },
    });
    if (!member || member.role === 'VIEWER') {
      throw new AppError(403, 'Insufficient permissions');
    }

    const doc = await prisma.document.create({
      data: {
        title: body.title,
        type: body.type,
        projectId: body.projectId,
        authorId: userId,
        content: body.content ?? '',
      },
    });

    await logAudit({ userId, documentId: doc.id, action: AuditAction.CREATED });

    res.status(201).json({
      data: { ...doc, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString() },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const body = UpdateDocumentSchema.parse(req.body);

    const existing = await assertDocumentAccess(id, userId);

    // Create a version snapshot before updating content
    if (body.content && body.content !== existing.content) {
      await prisma.docVersion.create({
        data: {
          documentId: id,
          content: existing.content,
          authorId: userId,
        },
      });
    }

    const doc = await prisma.document.update({
      where: { id },
      data: body,
    });

    const auditAction = body.status ? AuditAction.STATUS_CHANGED : AuditAction.UPDATED;
    await logAudit({ userId, documentId: id, action: auditAction, metadata: body.status ? { status: body.status } : undefined });

    res.json({
      data: { ...doc, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString() },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await assertDocumentAccess(id, userId);

    await prisma.document.delete({ where: { id } });
    await logAudit({ userId, documentId: id, action: AuditAction.DELETED });

    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function generateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = GenerateSchema.parse(req.body);

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, members: { some: { userId } } },
    });
    if (!project) throw new AppError(404, 'Project not found');

    const generationInput = resolveGenerationInput(body.input, body.documentType, project.referenceContextLength);

    // Get user settings for global prefix and defaults
    const settings = await prisma.userSettings.findUnique({ where: { userId } });

    await streamDocumentGeneration(
      {
        input: generationInput,
        documentType: body.documentType,
        clientContext: buildFullClientContext(project),
        language: body.language ?? settings?.language ?? 'en',
        tone: (body.tone ?? settings?.tone ?? 'Formal') as 'Formal' | 'Startup' | 'Technical',
      },
      res,
      settings?.systemPromptPrefix ?? undefined
    );

    await logAudit({
      userId,
      action: AuditAction.CREATED,
      metadata: { projectId: body.projectId, documentType: body.documentType },
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const doc = await assertDocumentAccess(id, userId);

    await streamCPOReview(
      {
        documentContent: doc.content,
        clientContext: buildFullClientContext(doc.project),
      },
      res
    );

    await logAudit({ userId, documentId: id, action: AuditAction.REVIEWED });
  } catch (error) {
    next(error);
  }
}

export async function getVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await assertDocumentAccess(id, userId);

    const versions = await prisma.docVersion.findMany({
      where: { documentId: id },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: versions.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function restoreVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id, versionId } = req.params;

    const doc = await assertDocumentAccess(id, userId);
    const version = await prisma.docVersion.findFirst({
      where: { id: versionId, documentId: id },
    });
    if (!version) throw new AppError(404, 'Version not found');

    // Snapshot current before restoring
    await prisma.docVersion.create({
      data: { documentId: id, content: doc.content, authorId: userId, label: 'Pre-restore snapshot' },
    });

    const updated = await prisma.document.update({
      where: { id },
      data: { content: version.content },
    });

    await logAudit({ userId, documentId: id, action: AuditAction.VERSION_RESTORED, metadata: { versionId } });

    res.json({
      data: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() },
    });
  } catch (error) {
    next(error);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await assertDocumentAccess(id, userId);

    const body = z.object({
      anchorId: z.string(),
      body: z.string().min(1),
      parentId: z.string().optional(),
    }).parse(req.body);

    const comment = await prisma.comment.create({
      data: { documentId: id, authorId: userId, ...body },
      include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    await logAudit({ userId, documentId: id, action: AuditAction.COMMENTED });

    res.status(201).json({
      data: { ...comment, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString() },
    });
  } catch (error) {
    next(error);
  }
}

export async function getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await assertDocumentAccess(id, userId);

    const comments = await prisma.comment.findMany({
      where: { documentId: id, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        replies: {
          include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      data: comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        replies: c.replies.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { commentId } = req.params;

    const body = z.object({
      resolved: z.boolean().optional(),
      body: z.string().min(1).optional(),
    }).parse(req.body);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'Comment not found');
    if (comment.authorId !== userId && req.user?.role !== 'ADMIN') {
      throw new AppError(403, 'Cannot update another user\'s comment');
    }

    const updated = await prisma.comment.update({ where: { id: commentId }, data: body });

    res.json({
      data: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() },
    });
  } catch (error) {
    next(error);
  }
}
