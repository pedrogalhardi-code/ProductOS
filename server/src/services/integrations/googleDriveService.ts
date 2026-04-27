import axios from 'axios';
import { prisma } from '../db';
import { AppError } from '../../middleware/errorHandler';

async function getDriveToken(userId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { userId_service: { userId, service: 'GOOGLE_DRIVE' } },
  });
  if (!integration) throw new AppError(400, 'Google Drive not connected');
  return integration.accessToken;
}

export async function exportToGoogleDoc(
  userId: string,
  title: string,
  content: string,
  parentFolderId?: string
): Promise<{ fileId: string; url: string }> {
  const token = await getDriveToken(userId);

  // Create Google Doc via Drive API
  const metadata: Record<string, unknown> = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
  };
  if (parentFolderId) metadata.parents = [parentFolderId];

  // Create the file
  const createRes = await axios.post(
    'https://www.googleapis.com/drive/v3/files?uploadType=multipart',
    JSON.stringify(metadata),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const fileId = createRes.data.id as string;

  // Update the content via Docs API
  await axios.request({
    method: 'POST',
    url: `https://docs.googleapis.com/v1/documents/${fileId}:batchUpdate`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });

  return {
    fileId,
    url: `https://docs.google.com/document/d/${fileId}/edit`,
  };
}

export async function importFromGoogleDoc(userId: string, fileId: string): Promise<string> {
  const token = await getDriveToken(userId);

  // Export as plain text
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data as string;
}

export async function getOAuthURL(userId: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new AppError(500, 'Google OAuth not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── Project reference folder (read existing Drive trees) ─────────────────────

const MAX_REFERENCE_CHARS = 120_000;
const MAX_REFERENCE_FILES = 100;
const MAX_FOLDER_DEPTH = 5;
const MAX_BINARY_BYTES = 600_000;

export interface DriveBrowseItem {
  id: string;
  name: string;
  mimeType: string;
}

export async function browseDriveFolder(
  userId: string,
  parentId: string
): Promise<{ items: DriveBrowseItem[] }> {
  const token = await getDriveToken(userId);
  const q =
    parentId === 'root'
      ? "'root' in parents and trashed=false"
      : `'${parentId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType),nextPageToken',
    pageSize: '100',
    orderBy: 'folder,name',
  });
  const { data } = await axios.get<{ files?: DriveBrowseItem[]; nextPageToken?: string }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return { items: data.files ?? [] };
}

export async function getDriveFileName(userId: string, fileId: string): Promise<string> {
  const token = await getDriveToken(userId);
  const { data } = await axios.get<{ name?: string }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.name ?? 'Folder';
}

export async function assertDriveFolder(userId: string, folderId: string): Promise<void> {
  if (folderId === 'root') return;
  const token = await getDriveToken(userId);
  const { data } = await axios.get<{ mimeType?: string }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=mimeType`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new AppError(400, 'The selected item must be a Google Drive folder');
  }
}

async function fetchDriveFileAsReferenceChunk(
  token: string,
  id: string,
  mimeType: string,
  name: string
): Promise<string | null> {
  if (mimeType === 'application/vnd.google-apps.folder') return null;

  if (mimeType === 'application/vnd.google-apps.document') {
    const r = await axios.get(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export`,
      {
        params: { mimeType: 'text/plain' },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
        transformResponse: [(d) => d],
      }
    );
    const body = String(r.data).slice(0, MAX_BINARY_BYTES);
    return `### ${name} (Google Doc)\n\n${body}\n\n`;
  }

  const textish =
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    /\.(md|txt|csv|html|htm|xml|yaml|yml|json)$/i.test(name);

  if (!textish) return null;

  const meta = await axios.get<{ size?: string }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=size`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const sz = parseInt(meta.data.size ?? '0', 10);
  if (sz > MAX_BINARY_BYTES) {
    return `### ${name}\n\n[Skipped: file too large for reference import]\n\n`;
  }

  const r = await axios.get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, {
    params: { alt: 'media' },
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'text',
    transformResponse: [(d) => d],
  });
  return `### ${name}\n\n${String(r.data).slice(0, MAX_BINARY_BYTES)}\n\n`;
}

type CollectState = { parts: string[]; totalLen: number; fileCount: number };

async function collectFromDriveFolder(
  token: string,
  folderId: string,
  depth: number,
  state: CollectState
): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH || state.fileCount >= MAX_REFERENCE_FILES || state.totalLen >= MAX_REFERENCE_CHARS) {
    return;
  }

  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: '100',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const { data } = await axios.get<{
      nextPageToken?: string;
      files?: { id: string; name: string; mimeType: string }[];
    }>(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    for (const f of data.files ?? []) {
      if (state.totalLen >= MAX_REFERENCE_CHARS || state.fileCount >= MAX_REFERENCE_FILES) return;

      if (f.mimeType === 'application/vnd.google-apps.folder') {
        state.parts.push(`\n## Folder: ${f.name}\n`);
        state.totalLen += f.name.length + 20;
        await collectFromDriveFolder(token, f.id, depth + 1, state);
        continue;
      }

      const chunk = await fetchDriveFileAsReferenceChunk(token, f.id, f.mimeType, f.name);
      if (chunk) {
        state.parts.push(chunk);
        state.totalLen += chunk.length;
        state.fileCount += 1;
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);
}

/** Recursively reads text-like files under a Drive folder into one plain-text blob (capped). */
export async function buildDriveFolderReferenceText(
  userId: string,
  folderId: string
): Promise<{ text: string; folderName: string }> {
  const token = await getDriveToken(userId);
  const folderName = folderId === 'root' ? 'My Drive' : await getDriveFileName(userId, folderId);

  const state: CollectState = { parts: [], totalLen: 0, fileCount: 0 };
  await collectFromDriveFolder(token, folderId, 0, state);

  let text = state.parts.join('').trim();
  if (text.length > MAX_REFERENCE_CHARS) {
    text = text.slice(0, MAX_REFERENCE_CHARS) + '\n\n[Truncated: reference material limit reached]\n';
  }

  return { text, folderName };
}
