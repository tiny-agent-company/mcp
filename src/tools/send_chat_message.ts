import { mcpFetch } from '../lib/mcp-fetch.js';

export const sendSupportMessageDefinition = {
  name: 'send_support_message',
  description: 'Send a message in an existing support conversation',
  inputSchema: {
    type: 'object' as const,
    properties: {
      conversation_id: { type: 'string', description: 'The conversation ID' },
      message: { type: 'string', description: 'Your message' },
    },
    required: ['conversation_id', 'message'],
  },
  annotations: {
    title: 'Send Support Message',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function sendSupportMessage(args: { conversation_id: string; message: string }, jwt: string) {
  const res = await mcpFetch(`/chat/conversations/${args.conversation_id}/messages`, jwt, {
    method: 'POST',
    body: JSON.stringify({ body: args.message }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  return {
    content: [{ type: 'text' as const, text: 'Message sent.' }],
  };
}
