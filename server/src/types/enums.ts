/**
 * String constants replacing Prisma enums (SQLite doesn't support enums).
 * Use these everywhere instead of importing from @prisma/client.
 */

export const Role = {
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const DocumentType = {
  PRD: 'PRD',
  USER_STORIES: 'USER_STORIES',
  TECHNICAL_SPEC: 'TECHNICAL_SPEC',
  PRODUCT_BRIEF: 'PRODUCT_BRIEF',
  ROADMAP: 'ROADMAP',
  OKRS: 'OKRS',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const IntegrationService = {
  JIRA: 'JIRA',
  CONFLUENCE: 'CONFLUENCE',
  SLACK: 'SLACK',
  FIGMA: 'FIGMA',
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
} as const;
export type IntegrationService = (typeof IntegrationService)[keyof typeof IntegrationService];

export const AuditAction = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  EXPORTED: 'EXPORTED',
  SHARED: 'SHARED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PUSHED_TO_JIRA: 'PUSHED_TO_JIRA',
  PUSHED_TO_CONFLUENCE: 'PUSHED_TO_CONFLUENCE',
  PUSHED_TO_GDRIVE: 'PUSHED_TO_GDRIVE',
  SLACK_NOTIFIED: 'SLACK_NOTIFIED',
  REVIEWED: 'REVIEWED',
  COMMENTED: 'COMMENTED',
  VERSION_RESTORED: 'VERSION_RESTORED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
