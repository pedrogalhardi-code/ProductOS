import axios from 'axios';
import { AppError } from '../../middleware/errorHandler';

interface FigmaFileMetadata {
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
}

/** Extract the Figma file key from a Figma URL */
export function extractFigmaFileKey(url: string): string | null {
  const match = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/.exec(url);
  return match ? match[1] : null;
}

/** Fetch Figma file metadata using the Figma API */
export async function getFigmaFileMetadata(
  accessToken: string,
  fileKey: string
): Promise<FigmaFileMetadata> {
  const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': accessToken },
  });

  return {
    name: response.data.name as string,
    lastModified: response.data.lastModified as string,
    thumbnailUrl: response.data.thumbnailUrl as string | undefined,
  };
}

/** Get OAuth URL for Figma */
export function getFigmaOAuthURL(): string {
  const clientId = process.env.FIGMA_CLIENT_ID;
  if (!clientId) throw new AppError(500, 'Figma OAuth not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.CLIENT_URL}/integrations/figma/callback`,
    scope: 'file_read',
    state: 'figma',
    response_type: 'code',
  });

  return `https://www.figma.com/oauth?${params.toString()}`;
}
