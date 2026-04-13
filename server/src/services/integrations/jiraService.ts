/**
 * Jira Integration Service
 * Push user stories as Jira issues with GIVEN/WHEN/THEN ACs.
 */

import axios from 'axios';
import { prisma } from '../db';
import { AppError } from '../../middleware/errorHandler';
import type { JiraStory } from '../../../../shared/types';

interface JiraIssuePayload {
  fields: {
    project: { key: string };
    summary: string;
    description: {
      type: string;
      version: number;
      content: { type: string; content: { type: string; text: string }[] }[];
    };
    issuetype: { name: string };
    priority: { name: string };
    story_points?: number;
    customfield_10016?: number; // Story points field (varies by Jira instance)
    parent?: { key: string };
    [key: string]: unknown;
  };
}

async function getJiraClient(userId: string) {
  const integration = await prisma.integration.findUnique({
    where: { userId_service: { userId, service: 'JIRA' } },
  });

  if (!integration) throw new AppError(400, 'Jira not connected. Please connect Jira in Settings.');

  const baseURL = process.env.JIRA_BASE_URL;
  if (!baseURL) throw new AppError(500, 'JIRA_BASE_URL not configured');

  return axios.create({
    baseURL: `${baseURL}/rest/api/3`,
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

export async function pushStoriesToJira(
  userId: string,
  projectKey: string,
  epicName: string | undefined,
  stories: JiraStory[]
): Promise<{ createdIssues: { title: string; key: string; url: string }[] }> {
  const jira = await getJiraClient(userId);
  const baseURL = process.env.JIRA_BASE_URL;
  const createdIssues: { title: string; key: string; url: string }[] = [];

  // Create Epic first if specified
  let epicKey: string | undefined;
  if (epicName) {
    const epicPayload: JiraIssuePayload = {
      fields: {
        project: { key: projectKey },
        summary: epicName,
        issuetype: { name: 'Epic' },
        description: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: `Epic created by ProductOS` }] }],
        },
        priority: { name: 'Medium' },
      },
    };

    const epicRes = await jira.post('/issue', epicPayload);
    epicKey = epicRes.data.key as string;
  }

  // Create story issues
  for (const story of stories) {
    const payload: JiraIssuePayload = {
      fields: {
        project: { key: projectKey },
        summary: story.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: story.description }],
            },
            {
              type: 'heading',
              content: [{ type: 'text', text: 'Acceptance Criteria' }],
            },
            {
              type: 'codeBlock',
              content: [{ type: 'text', text: story.acceptanceCriteria }],
            },
          ],
        },
        issuetype: { name: 'Story' },
        priority: { name: mapPriority(story.priority) },
        customfield_10016: story.storyPoints,
        ...(epicKey && { parent: { key: epicKey } }),
        ...(story.epicKey && !epicKey && { parent: { key: story.epicKey } }),
      },
    };

    const storyRes = await jira.post('/issue', payload);
    const issueKey = storyRes.data.key as string;
    createdIssues.push({
      title: story.title,
      key: issueKey,
      url: `${baseURL}/browse/${issueKey}`,
    });
  }

  return { createdIssues };
}

export async function getJiraEpics(userId: string, projectKey: string): Promise<{ key: string; summary: string }[]> {
  const jira = await getJiraClient(userId);

  const response = await jira.post('/search', {
    jql: `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`,
    fields: ['summary'],
    maxResults: 50,
  });

  return (response.data.issues as { key: string; fields: { summary: string } }[]).map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
  }));
}

function mapPriority(priority: string): string {
  const map: Record<string, string> = {
    Critical: 'Highest',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
  };
  return map[priority] ?? 'Medium';
}

export async function getOAuthURL(): Promise<string> {
  const clientId = process.env.JIRA_CLIENT_ID;
  if (!clientId) throw new AppError(500, 'Jira OAuth not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.CLIENT_URL}/integrations/jira/callback`,
    response_type: 'code',
    scope: 'read:jira-work write:jira-work read:me',
    state: 'jira',
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}
