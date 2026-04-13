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
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
