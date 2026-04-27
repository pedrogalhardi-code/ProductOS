import type { DocumentStatus, DocumentType } from '@shared/types';

interface BadgeProps {
  type?: 'status' | 'type';
  value: DocumentStatus | DocumentType;
}

const statusLabel: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
};

const statusClass: Record<DocumentStatus, string> = {
  DRAFT: 'badge-draft',
  IN_REVIEW: 'badge-review',
  APPROVED: 'badge-approved',
  ARCHIVED: 'badge-archived',
};

const typeLabel: Record<DocumentType, string> = {
  PRD: 'PRD',
  USER_STORIES: 'User Stories',
  TECHNICAL_SPEC: 'Technical Spec',
  PRODUCT_BRIEF: 'Product Brief',
  ROADMAP: 'Roadmap',
  OKRS: 'OKRs',
};

export default function Badge({ type = 'status', value }: BadgeProps) {
  if (type === 'status') {
    const s = value as DocumentStatus;
    return <span className={statusClass[s]}>{statusLabel[s]}</span>;
  }

  const t = value as DocumentType;
  return <span className="badge-type">{typeLabel[t]}</span>;
}
