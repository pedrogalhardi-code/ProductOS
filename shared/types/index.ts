// Shared types between client and server

export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type DocumentType =
  | 'PRD'
  | 'USER_STORIES'
  | 'TECHNICAL_SPEC'
  | 'PRODUCT_BRIEF'
  | 'ROADMAP'
  | 'OKRS';

export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';

export type IntegrationService =
  | 'JIRA'
  | 'CONFLUENCE'
  | 'SLACK'
  | 'FIGMA'
  | 'GOOGLE_DRIVE';

export type ExportFormat = 'PDF' | 'MARKDOWN' | 'CONFLUENCE' | 'GOOGLE_DRIVE';

export type Tone = 'Formal' | 'Startup' | 'Technical';

// ─── API Payload Types ────────────────────────────────────────────────────────

export interface GenerateDocumentPayload {
  projectId: string;
  documentType: DocumentType;
  input: string; // Idea, meeting notes, or structured form JSON
  inputType: 'idea' | 'notes' | 'form' | 'url';
  language?: string;
  tone?: Tone;
}

export interface ReviewDocumentPayload {
  documentId: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  clientContext: string;
  // attachments are sent as multipart/form-data and handled server-side,
  // not part of this JSON payload.
}

export interface ProjectAttachmentDto {
  id: string;
  projectId: string;
  name: string;
  size: number;
  createdAt: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  clientContext?: string;
}

export interface CreateDocumentPayload {
  title: string;
  type: DocumentType;
  projectId: string;
  content?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  status?: DocumentStatus;
  content?: string;
  figmaFileUrl?: string;
  figmaFileName?: string;
}

export interface CreateCommentPayload {
  anchorId: string;
  body: string;
  parentId?: string;
}

export interface UpdateCommentPayload {
  resolved?: boolean;
  body?: string;
}

export interface ExportDocumentPayload {
  format: ExportFormat;
  confluenceSpaceKey?: string;
  driveParentFolderId?: string;
}

export interface PushToJiraPayload {
  projectKey: string;
  epicName?: string;
  stories: JiraStory[];
}

export interface JiraStory {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  storyPoints?: number;
  epicKey?: string;
}

export interface PostToSlackPayload {
  channelId: string;
  documentId: string;
  message?: string;
}

export interface UpdateSettingsPayload {
  language?: string;
  tone?: Tone;
  systemPromptPrefix?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export type ChatMode = 'chat' | 'generate' | 'edit';

export interface ChatStreamPayload {
  messages: ChatMessage[];
  mode: ChatMode;
  projectId?: string;
  documentType?: DocumentType;
  currentContent?: string;
  language?: string;
  tone?: Tone;
}

export interface AnalyzeDocumentPayload {
  documentType: DocumentType;
  // file sent as multipart/form-data
}

export interface AnalyzeDocumentResponse {
  analysis: string;
  extractedText: string;
  fileName: string;
  fileSize: number;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  description?: string | null;
  clientContext: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  documentCount?: number;
  attachments?: ProjectAttachmentDto[];
}

export interface DocumentDto {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  content: string;
  projectId: string;
  authorId: string;
  currentVersionId?: string | null;
  jiraEpicKey?: string | null;
  figmaFileUrl?: string | null;
  figmaFileName?: string | null;
  figmaLastModified?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: UserDto;
  project?: ProjectDto;
  versionCount?: number;
}

export interface DocVersionDto {
  id: string;
  documentId: string;
  content: string;
  label?: string | null;
  changes?: string | null;
  createdAt: string;
  authorId: string;
  author?: UserDto;
}

export interface CommentDto {
  id: string;
  documentId: string;
  authorId: string;
  anchorId: string;
  body: string;
  resolved: boolean;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: UserDto;
  replies?: CommentDto[];
}

export interface IntegrationDto {
  id: string;
  service: IntegrationService;
  connected: boolean;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType =
  | 'start'
  | 'delta'
  | 'section'
  | 'done'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  section?: string;
  documentId?: string;
  error?: string;
}

// ─── AC Parser Types ──────────────────────────────────────────────────────────

export interface GherkinScenario {
  name: string;
  steps: GherkinStep[];
}

export interface GherkinStep {
  keyword: 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT';
  text: string;
}

export interface AcceptanceCriteria {
  groupNumber: number;
  groupName: string;
  scenarios: {
    id: string;
    name: string;
    steps: GherkinStep[];
  }[];
}
