const TEXT_NAME =
  /\.(txt|md|markdown|json|csv|html|htm|xml|yaml|yml|ts|tsx|js|jsx|css|scss|sql|sh|env)$/i;
const MAX_FILE_BYTES = 400_000;
const MAX_TOTAL_CHARS = 120_000;

async function readTextFile(handle: FileSystemFileHandle): Promise<string | null> {
  const file = await handle.getFile();
  if (file.size > MAX_FILE_BYTES) return null;
  const name = file.name;
  if (!TEXT_NAME.test(name) && !file.type.startsWith('text/') && file.type !== 'application/json') {
    return null;
  }
  const text = await file.text();
  return `### ${name}\n\n${text}\n\n`;
}

async function scanDirectory(dir: FileSystemDirectoryHandle, depth: number, acc: string[]): Promise<void> {
  if (depth > 6) return;
  let total = acc.join('').length;
  if (total >= MAX_TOTAL_CHARS) return;

  for await (const entry of dir.values()) {
    if (total >= MAX_TOTAL_CHARS) break;
    if (entry.kind === 'file') {
      const chunk = await readTextFile(entry);
      if (chunk) {
        acc.push(chunk);
        total += chunk.length;
      }
    } else if (entry.kind === 'directory') {
      acc.push(`\n## Folder: ${entry.name}\n\n`);
      total = acc.join('').length;
      await scanDirectory(entry, depth + 1, acc);
      total = acc.join('').length;
    }
  }
}

export interface LocalFolderScanResult {
  label: string;
  text: string;
}

/**
 * Opens the browser folder picker (Chrome / Edge / Opera over HTTPS or localhost)
 * and reads text-like files into a single blob for project AI context.
 */
export async function pickAndScanLocalContextFolder(): Promise<LocalFolderScanResult | null> {
  const picker = window.showDirectoryPicker;
  if (typeof picker !== 'function') {
    throw new Error(
      'This browser does not support choosing a folder. Try Chrome or Edge, and use HTTPS or localhost.'
    );
  }

  const root = await picker();
  const parts: string[] = [];
  await scanDirectory(root, 0, parts);
  const text = parts.join('').trim().slice(0, MAX_TOTAL_CHARS);
  return { label: root.name, text };
}
