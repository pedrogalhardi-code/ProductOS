import type { Project } from '@prisma/client';

/** Merges typed client context with optional folder / Drive reference text for AI prompts. */
export function buildFullClientContext(project: Pick<Project, 'clientContext' | 'referenceContextMaterial'>): string {
  const extra = (project.referenceContextMaterial ?? '').trim();
  if (!extra) return project.clientContext;
  return `${project.clientContext}\n\n--- Reference materials (local folder or Google Drive) ---\n${extra}`;
}
