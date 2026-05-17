import { mcpFetch } from '../lib/mcp-fetch.js';

export const readSupportChatDefinition = {
  name: 'read_support_chat',
  description: 'Read the message history of a support conversation',
  inputSchema: {
    type: 'object' as const,
    properties: {
      conversation_id: { type: 'string', description: 'The conversation ID' },
    },
    required: ['conversation_id'],
  },
  annotations: {
    title: 'Read Support Chat',
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function readSupportChat(args: { conversation_id: string }, jwt: string) {
  const res = await mcpFetch(`/chat/conversations/${args.conversation_id}/messages`, jwt);

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  const messages = (await res.json()) as Array<{
    id: string;
    role: string;
    body: string;
    createdAt: string;
  }>;

  if (messages.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No messages yet.' }] };
  }

  const lines = messages.map((m) => {
    const who = m.role === 'visitor' ? 'You' : 'Support';
    const time = new Date(m.createdAt).toLocaleTimeString();
    return `[${time}] ${who}: ${m.body}`;
  });

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
