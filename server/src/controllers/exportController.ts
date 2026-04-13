import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { AppError } from '../middleware/errorHandler';
import { exportToConfluence } from '../services/integrations/confluenceService';
import { exportToGoogleDoc } from '../services/integrations/googleDriveService';
import { logAudit } from '../services/auditService';
import { AuditAction } from '../types/enums';

const ExportSchema = z.object({
  format: z.enum(['PDF', 'MARKDOWN', 'CONFLUENCE', 'GOOGLE_DRIVE']),
  confluenceSpaceKey: z.string().optional(),
  driveParentFolderId: z.string().optional(),
});

export async function exportController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const body = ExportSchema.parse(req.body);

    const doc = await prisma.document.findFirst({
      where: { id, project: { members: { some: { userId } } } },
      include: { project: true },
    });
    if (!doc) throw new AppError(404, 'Document not found');

    switch (body.format) {
      case 'MARKDOWN': {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.title}.md"`);
        res.send(doc.content);
        break;
      }

      case 'CONFLUENCE': {
        if (!body.confluenceSpaceKey) {
          throw new AppError(400, 'confluenceSpaceKey is required for Confluence export');
        }
        const result = await exportToConfluence({
          userId,
          spaceKey: body.confluenceSpaceKey,
          title: doc.title,
          content: doc.content,
        });
        await logAudit({ userId, documentId: id, action: AuditAction.PUSHED_TO_CONFLUENCE });
        res.json({ data: { pageId: result.pageId, url: result.url } });
        break;
      }

      case 'GOOGLE_DRIVE': {
        const result = await exportToGoogleDoc(
          userId,
          doc.title,
          doc.content,
          body.driveParentFolderId
        );
        await logAudit({ userId, documentId: id, action: AuditAction.PUSHED_TO_GDRIVE });
        res.json({ data: { fileId: result.fileId, url: result.url } });
        break;
      }

      case 'PDF': {
        // PDF export using pdfkit
        const PDFDocument = (await import('pdfkit')).default;
        const pdf = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.title}.pdf"`);
        pdf.pipe(res);

        pdf.fontSize(24).font('Helvetica-Bold').text(doc.title, { align: 'center' });
        pdf.moveDown();
        pdf.fontSize(12).font('Helvetica').text(`Project: ${doc.project.name}`, { align: 'center' });
        pdf.fontSize(10).text(`Type: ${doc.type} | Status: ${doc.status}`, { align: 'center' });
        pdf.moveDown(2);

        // Render content (strip markdown/JSON and render as plain text)
        const plainContent = extractPlainText(doc.content);
        pdf.fontSize(11).font('Helvetica').text(plainContent, {
          width: 495,
          align: 'left',
          lineGap: 4,
        });

        pdf.end();
        await logAudit({ userId, documentId: id, action: AuditAction.EXPORTED });
        break;
      }

      default:
        throw new AppError(400, 'Unsupported export format');
    }
  } catch (error) {
    next(error);
  }
}

function extractPlainText(content: string): string {
  try {
    // Try JSON (TipTap format)
    const json = JSON.parse(content) as { content?: { content?: { text?: string }[] }[] };
    if (json.content) {
      return extractFromTipTap(json);
    }
  } catch {
    // Plain text / markdown
  }
  // Strip markdown formatting
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

function extractFromTipTap(node: { type?: string; text?: string; content?: unknown[] }): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';

  const lines: string[] = [];
  for (const child of node.content) {
    const childNode = child as { type?: string; text?: string; content?: unknown[] };
    const text = extractFromTipTap(childNode);
    if (text) lines.push(text);
  }
  return lines.join('\n');
}
