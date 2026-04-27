/**
 * Extract plain text from an uploaded file buffer.
 * Supports: PDF, Markdown, plain text.
 */
import pdfParse from 'pdf-parse';

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    lowerMime.startsWith('text/') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.txt')
  ) {
    return buffer.toString('utf-8');
  }

  return buffer.toString('utf-8');
}
