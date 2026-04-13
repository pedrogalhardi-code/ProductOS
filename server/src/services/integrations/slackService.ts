import axios from 'axios';
import { prisma } from '../db';
import { AppError } from '../../middleware/errorHandler';

async function getSlackToken(userId: string): Promise<string> {
  const integration = await prisma.integration.findUnique({
    where: { userId_service: { userId, service: 'SLACK' } },
  });
  if (!integration) throw new AppError(400, 'Slack not connected');
  return integration.accessToken;
}

export async function postDocumentSummary(
  userId: string,
  channelId: string,
  documentTitle: string,
  documentUrl: string,
  summary: string
): Promise<void> {
  const token = await getSlackToken(userId);

  const message = {
    channel: channelId,
    text: `📄 *${documentTitle}* has been approved in ProductOS`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📄 *<${documentUrl}|${documentTitle}>* has been approved\n\n${summary}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Document' },
            url: documentUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };

  await axios.post('https://slack.com/api/chat.postMessage', message, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function getSlackChannels(userId: string): Promise<{ id: string; name: string }[]> {
  const token = await getSlackToken(userId);

  const response = await axios.get('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  });

  return (response.data.channels as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}

export async function notifyComment(
  userId: string,
  channelId: string,
  commenterName: string,
  documentTitle: string,
  commentBody: string,
  documentUrl: string
): Promise<void> {
  const token = await getSlackToken(userId);

  await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel: channelId,
      text: `💬 ${commenterName} commented on *${documentTitle}*: "${commentBody.slice(0, 100)}..."`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💬 *${commenterName}* commented on <${documentUrl}|${documentTitle}>\n> ${commentBody.slice(0, 200)}`,
          },
        },
      ],
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}
