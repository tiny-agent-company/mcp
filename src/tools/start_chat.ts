import { mcpFetch } from '../lib/mcp-fetch.js';

export const startSupportChatDefinition = {
  name: 'start_support_chat',
  description: 'Start a new support conversation and send the first message',
  inputSchema: {
    type: 'object' as const,
    properties: {
      message: { type: 'string', description: 'Your initial support message' },
    },
    required: ['message'],
  },
  annotations: {
    title: 'Start Support Chat',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function startSupportChat(args: { message: string }, jwt: string) {
  // Create conversation
  const convoRes = await mcpFetch('/chat/conversations', jwt, { method: 'POST' });
  if (!convoRes.ok) throw new Error(`API error ${convoRes.status}: ${await convoRes.text()}`);
  const conversation = (await convoRes.json()) as { id: string };

  // Send first message
  const msgRes = await mcpFetch(`/chat/conversations/${conversation.id}/messages`, jwt, {
    method: 'POST',
    body: JSON.stringify({ body: args.message }),
  });
  if (!msgRes.ok) throw new Error(`API error ${msgRes.status}: ${await msgRes.text()}`);

  return {
    content: [{
      type: 'text' as const,
      text: `Support conversation started (ID: ${conversation.id}). Your message has been sent. Use read_support_chat to check for replies.`,
    }],
  };
}
