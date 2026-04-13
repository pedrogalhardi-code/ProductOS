import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../services/db';
import { AppError } from '../middleware/errorHandler';
import { pushStoriesToJira, getJiraEpics } from '../services/integrations/jiraService';
import { getConfluenceSpaces } from '../services/integrations/confluenceService';
import { postDocumentSummary, getSlackChannels } from '../services/integrations/slackService';
import { logAudit } from '../services/auditService';
import { AuditAction } from '../types/enums';

const router = Router();

// List all connected integrations for the user
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const integrations = await prisma.integration.findMany({
      where: { userId },
      select: { service: true, expiresAt: true, metadata: true, updatedAt: true },
    });

    const allServices = ['JIRA', 'CONFLUENCE', 'SLACK', 'FIGMA', 'GOOGLE_DRIVE'];
    res.json({
      data: allServices.map((service) => {
        const found = integrations.find((i) => i.service === service);
        return {
          service,
          connected: !!found,
          expiresAt: found?.expiresAt?.toISOString() ?? null,
          metadata: found?.metadata ? JSON.parse(found.metadata) : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Disconnect an integration
router.delete('/:service', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { service } = req.params;

    await prisma.integration.deleteMany({
      where: { userId, service: service as never },
    });

    res.json({ data: { disconnected: true, service } });
  } catch (error) {
    next(error);
  }
});

// ─── Jira ─────────────────────────────────────────────────────────────────────

const PushToJiraSchema = z.object({
  projectKey: z.string().min(1),
  epicName: z.string().optional(),
  stories: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      acceptanceCriteria: z.string(),
      priority: z.enum(['Critical', 'High', 'Medium', 'Low']),
      storyPoints: z.number().optional(),
      epicKey: z.string().optional(),
    })
  ),
});

router.post('/jira/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = PushToJiraSchema.parse(req.body);

    const result = await pushStoriesToJira(userId, body.projectKey, body.epicName, body.stories);
    await logAudit({ userId, action: AuditAction.PUSHED_TO_JIRA });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/jira/epics/:projectKey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const epics = await getJiraEpics(userId, req.params.projectKey);
    res.json({ data: epics });
  } catch (error) {
    next(error);
  }
});

// ─── Confluence ───────────────────────────────────────────────────────────────

router.get('/confluence/spaces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaces = await getConfluenceSpaces(req.userId!);
    res.json({ data: spaces });
  } catch (error) {
    next(error);
  }
});

// ─── Slack ────────────────────────────────────────────────────────────────────

router.get('/slack/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const channels = await getSlackChannels(req.userId!);
    res.json({ data: channels });
  } catch (error) {
    next(error);
  }
});

router.post('/slack/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = z.object({
      channelId: z.string(),
      documentId: z.string().cuid(),
      message: z.string().optional(),
    }).parse(req.body);

    const doc = await prisma.document.findFirst({
      where: { id: body.documentId, project: { members: { some: { userId } } } },
      include: { project: true },
    });
    if (!doc) throw new AppError(404, 'Document not found');

    const docUrl = `${process.env.CLIENT_URL}/documents/${doc.id}`;
    const summary = body.message ?? `${doc.type} document for ${doc.project.name} — ${doc.status}`;

    await postDocumentSummary(userId, body.channelId, doc.title, docUrl, summary);
    await logAudit({ userId, documentId: body.documentId, action: AuditAction.SLACK_NOTIFIED });

    res.json({ data: { sent: true } });
  } catch (error) {
    next(error);
  }
});

// ─── OAuth connect endpoints ──────────────────────────────────────────────────

router.post('/:service/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { service } = req.params;
    const { accessToken, refreshToken, expiresAt, metadata } = req.body as {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      metadata?: Record<string, unknown>;
    };

    if (!accessToken) throw new AppError(400, 'accessToken is required');

    const allowedServices = ['JIRA', 'CONFLUENCE', 'SLACK', 'FIGMA', 'GOOGLE_DRIVE'];
    if (!allowedServices.includes(service.toUpperCase())) {
      throw new AppError(400, `Unknown service: ${service}`);
    }

    await prisma.integration.upsert({
      where: { userId_service: { userId, service: service.toUpperCase() as never } },
      update: {
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      create: {
        userId,
        service: service.toUpperCase() as never,
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    res.json({ data: { connected: true, service: service.toUpperCase() } });
  } catch (error) {
    next(error);
  }
});

export default router;
