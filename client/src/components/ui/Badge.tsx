import type { DocumentStatus, DocumentType } from '@shared/types';

interface BadgeProps {
  type?: 'status' | 'type';
  value: DocumentStatus | DocumentType;
}

export default function Badge({ type = 'status', value }: BadgeProps) {
  if (type === 'status') {
    const status = value as DocumentStatus;
    switch (status) {
      case 'DRAFT':
        return <span className="badge-draft">Draft</span>;
      case 'IN_REVIEW':
        return <span className="badge-review">In Review</span>;
      case 'APPROVED':
        return <span className="badge-approved">Approved</span>;
      case 'ARCHIVED':
        return <span className="badge-archived">Archived</span>;
      default:
        return null;
    }
  }

  if (type === 'type') {
    const docType = value as DocumentType;
    const labelMap: Record<DocumentType, string> = {
      PRD: 'PRD',
      USER_STORIES: 'User Stories',
      TECHNICAL_SPEC: 'Technical Spec',
      PRODUCT_BRIEF: 'Product Brief',
      ROADMAP: 'Roadmap',
      OKRS: 'OKRs',
    };

    return (
      <span className="badge bg-blue-100 text-blue-700">
        {labelMap[docType]}
      </span>
    );
  }

  return null;
}
