import axios from 'axios';
import { prisma } from '../db';
import { AppError } from '../../middleware/errorHandler';

async function getConfluenceClient(userId: string) {
  const integration = await prisma.integration.findUnique({
    where: { userId_service: { userId, service: 'CONFLUENCE' } },
  });
  if (!integration) throw new AppError(400, 'Confluence not connected');

  const baseURL = process.env.CONFLUENCE_BASE_URL;
  if (!baseURL) throw new AppError(500, 'CONFLUENCE_BASE_URL not configured');

  return {
    client: axios.create({
      baseURL: `${baseURL}/rest/api`,
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'Content-Type': 'application/json',
      },
    }),
    baseURL,
  };
}

export interface ExportToConfluenceParams {
  userId: string;
  spaceKey: string;
  title: string;
  content: string; // Markdown content to convert to Confluence storage format
  parentPageId?: string;
}

export async function exportToConfluence(params: ExportToConfluenceParams): Promise<{ pageId: string; url: string }> {
  const { userId, spaceKey, title, content, parentPageId } = params;
  const { client, baseURL } = await getConfluenceClient(userId);

  // Convert markdown-ish content to Confluence storage format (simplified)
  const storageContent = markdownToConfluenceStorage(content);

  const payload: Record<string, unknown> = {
    type: 'page',
    title,
    space: { key: spaceKey },
    body: {
      storage: {
        value: storageContent,
        representation: 'storage',
      },
    },
  };

  if (parentPageId) {
    payload.ancestors = [{ id: parentPageId }];
  }

  const response = await client.post('/content', payload);
  const pageId = response.data.id as string;
  const url = `${baseURL}/pages/${pageId}`;

  return { pageId, url };
}

export async function importFromConfluence(userId: string, pageUrl: string): Promise<string> {
  const { client } = await getConfluenceClient(userId);

  // Extract page ID from URL
  const pageIdMatch = /\/pages\/(\d+)/.exec(pageUrl);
  if (!pageIdMatch) throw new AppError(400, 'Invalid Confluence page URL');

  const pageId = pageIdMatch[1];
  const response = await client.get(`/content/${pageId}?expand=body.storage`);

  return response.data.body.storage.value as string;
}

export async function getConfluenceSpaces(userId: string): Promise<{ key: string; name: string }[]> {
  const { client } = await getConfluenceClient(userId);
  const response = await client.get('/space?limit=50');

  return (response.data.results as { key: string; name: string }[]).map((s) => ({
    key: s.key,
    name: s.name,
  }));
}

/** Convert markdown headings and basic formatting to Confluence storage format */
function markdownToConfluenceStorage(markdown: string): string {
  return markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^([^<].+)$/gm, '<p>$1</p>');
}
