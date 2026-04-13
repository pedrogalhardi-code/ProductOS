import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import type {
  ProjectDto,
  DocumentDto,
  DocVersionDto,
  CommentDto,
  IntegrationDto,
  GenerateDocumentPayload,
  CreateProjectPayload,
  UpdateProjectPayload,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  CreateCommentPayload,
  UpdateCommentPayload,
  ExportDocumentPayload,
  PushToJiraPayload,
  PostToSlackPayload,
  UpdateSettingsPayload,
  DriveBrowseItemDto,
  PaginatedResponse,
  ApiResponse,
} from '@shared/types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — logout and redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  register: (email: string, name: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>>('/auth/register', { email, name, password }),
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string; role: string } }>>('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
  list: () => api.get<ApiResponse<ProjectDto[]>>('/projects'),
  get: (id: string) => api.get<ApiResponse<ProjectDto>>(`/projects/${id}`),
  create: (payload: CreateProjectPayload) => api.post<ApiResponse<ProjectDto>>('/projects', payload),
  update: (id: string, payload: UpdateProjectPayload) => api.patch<ApiResponse<ProjectDto>>(`/projects/${id}`, payload),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<DocumentDto>>('/documents', { params }),
  get: (id: string) => api.get<ApiResponse<DocumentDto>>(`/documents/${id}`),
  create: (payload: CreateDocumentPayload) =>
    api.post<ApiResponse<DocumentDto>>('/documents', payload),
  update: (id: string, payload: UpdateDocumentPayload) =>
    api.patch<ApiResponse<DocumentDto>>(`/documents/${id}`, payload),
  delete: (id: string) => api.delete(`/documents/${id}`),
  export: (id: string, payload: ExportDocumentPayload) =>
    api.post(`/documents/${id}/export`, payload, {
      responseType: payload.format === 'PDF' ? 'blob' : 'json',
    }),
  versions: (id: string) => api.get<ApiResponse<DocVersionDto[]>>(`/documents/${id}/versions`),
  restoreVersion: (id: string, versionId: string) =>
    api.post<ApiResponse<DocumentDto>>(`/documents/${id}/versions/${versionId}/restore`),
  comments: (id: string) => api.get<ApiResponse<CommentDto[]>>(`/documents/${id}/comments`),
  addComment: (id: string, payload: CreateCommentPayload) =>
    api.post<ApiResponse<CommentDto>>(`/documents/${id}/comments`, payload),
  updateComment: (commentId: string, payload: UpdateCommentPayload) =>
    api.patch<ApiResponse<CommentDto>>(`/documents/comments/${commentId}`, payload),
};

// ─── AI (SSE streaming) ───────────────────────────────────────────────────────

/**
 * Stream document generation via EventSource (SSE).
 * Returns a cleanup function to close the stream.
 */
export function streamGenerate(
  payload: GenerateDocumentPayload,
  onDelta: (delta: string) => void,
  onDone: (fullContent: string) => void,
  onError: (error: string) => void
): () => void {
  const token = useAuthStore.getState().token;

  // Use fetch for SSE POST (EventSource only supports GET)
  const controller = new AbortController();

  fetch('/api/documents/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        onError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; content?: string; error?: string };
            if (event.type === 'delta' && event.content) {
              onDelta(event.content);
            } else if (event.type === 'done' && event.content) {
              onDone(event.content);
            } else if (event.type === 'error') {
              onError(event.error ?? 'Generation failed');
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        onError(error.message);
      }
    });

  return () => controller.abort();
}

/**
 * Stream CPO review via SSE.
 */
export function streamReview(
  documentId: string,
  onDelta: (delta: string) => void,
  onSection: (section: string) => void,
  onDone: (fullContent: string) => void,
  onError: (error: string) => void
): () => void {
  const token = useAuthStore.getState().token;
  const controller = new AbortController();

  fetch(`/api/documents/${documentId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({}),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        onError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              section?: string;
              error?: string;
            };
            if (event.type === 'delta' && event.content) {
              onDelta(event.content);
            } else if (event.type === 'section' && event.section) {
              onSection(event.section);
            } else if (event.type === 'done' && event.content) {
              onDone(event.content);
            } else if (event.type === 'error') {
              onError(event.error ?? 'Review failed');
            }
          } catch {
            // Ignore
          }
        }
      }
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'AbortError') {
        onError(error.message);
      }
    });

  return () => controller.abort();
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export const integrations = {
  list: () => api.get<ApiResponse<IntegrationDto[]>>('/integrations'),
  connect: (service: string, payload: { accessToken: string; refreshToken?: string; metadata?: Record<string, unknown> }) =>
    api.post(`/integrations/${service}/connect`, payload),
  disconnect: (service: string) => api.delete(`/integrations/${service}`),
  pushToJira: (payload: PushToJiraPayload) => api.post('/integrations/jira/push', payload),
  jiraEpics: (projectKey: string) => api.get(`/integrations/jira/epics/${projectKey}`),
  confluenceSpaces: () => api.get('/integrations/confluence/spaces'),
  slackChannels: () => api.get('/integrations/slack/channels'),
  postToSlack: (payload: PostToSlackPayload) => api.post('/integrations/slack/post', payload),
  googleDriveBrowse: (parentId?: string) =>
    api.get<ApiResponse<{ items: DriveBrowseItemDto[] }>>('/integrations/google-drive/browse', {
      params: parentId ? { parentId } : {},
    }),
  googleDriveSyncProjectFolder: (payload: { projectId: string; folderId: string }) =>
    api.post<ApiResponse<ProjectDto>>('/integrations/google-drive/sync-project-folder', payload),
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settings = {
  get: () => api.get('/settings'),
  update: (payload: UpdateSettingsPayload) => api.patch('/settings', payload),
  aiUsage: (period?: string) => api.get(`/settings/ai-usage${period ? `?period=${period}` : ''}`),
};

export default api;
