import { mcpFetch } from '../lib/mcp-fetch.js';

export const checkBalanceDefinition = {
  name: 'check_balance',
  description: 'Check the live balance for a virtual card. Prefer this over get_card_details when you only need to verify available funds — it is faster and does not expose sensitive card credentials.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      card_id: { type: 'string', description: 'The card ID' },
    },
    required: ['card_id'],
  },
  annotations: {
    title: 'Check Card Balance',
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function checkBalance(args: { card_id: string }, jwt: string) {
  const res = await mcpFetch(`/cards/${args.card_id}/balance`, jwt);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const { balanceCents, cached } = (await res.json()) as {
    balanceCents: number;
    cached?: boolean;
  };

  const text = `Balance: $${(balanceCents / 100).toFixed(2)}${cached ? ' (cached)' : ''}`;
  return { content: [{ type: 'text' as const, text }] };
}
