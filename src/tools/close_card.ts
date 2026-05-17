import { mcpFetch } from '../lib/mcp-fetch.js';

export const closeCardDefinition = {
  name: 'close_card',
  description:
    'Permanently close a virtual card. This is irreversible — the card cannot be reopened. Safe to call on an already-closed card (idempotent).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      card_id: { type: 'string', description: 'The card ID to close' },
    },
    required: ['card_id'],
  },
  annotations: {
    title: 'Close Card',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function closeCard(args: { card_id: string }, jwt: string) {
  const res = await mcpFetch(`/cards/${args.card_id}/close`, jwt, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return { content: [{ type: 'text' as const, text: `Card ${args.card_id} has been closed.` }] };
}
