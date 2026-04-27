import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { streamChat } from '../services/aiService';
import { extractTextFromFile } from '../services/fileExtractor';
import { AppError } from '../middleware/errorHandler';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const ChatStreamSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  mode: z.enum(['chat', 'generate', 'edit']),
  projectId: z.string().cuid().optional(),
  documentType: z.enum(['PRD', 'USER_STORIES', 'TECHNICAL_SPEC', 'PRODUCT_BRIEF', 'ROADMAP', 'OKRS']).optional(),
  currentContent: z.string().optional(),
  language: z.string().optional(),
  tone: z.enum(['Formal', 'Startup', 'Technical']).optional(),
});

/**
 * POST /api/chat/extract — accepts a multipart file upload and returns the
 * extracted plain-text content so the client can include it in a chat message.
 */
export async function chatExtract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'Missing file upload');
    const text = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
    res.json({
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        text: text.slice(0, 100_000),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function chatStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const body = ChatStreamSchema.parse(req.body);

    // If projectId is provided, verify access and pull clientContext (+ attachments)
    let clientContext: string | undefined;
    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, members: { some: { userId } } },
        include: { attachments: true },
      });
      if (!project) throw new AppError(404, 'Project not found');

      clientContext = project.clientContext;
      if (project.attachments.length > 0) {
        const attachmentsBlock = project.attachments
          .map((a) => `[${a.name}]\n${a.text.slice(0, 3000)}`)
          .join('\n\n');
        clientContext += `\n\nReference attachments:\n${attachmentsBlock}`;
      }
    }

    // Get user's tone/language defaults if not explicitly passed
    const settings = await prisma.userSettings.findUnique({ where: { userId } });

    await streamChat(
      {
        messages: body.messages,
        mode: body.mode,
        clientContext,
        documentType: body.documentType,
        currentContent: body.currentContent,
        language: body.language ?? settings?.language ?? 'en',
        tone: (body.tone ?? settings?.tone ?? 'Formal') as 'Formal' | 'Startup' | 'Technical',
      },
      res
    );
  } catch (error) {
    next(error);
  }
}
