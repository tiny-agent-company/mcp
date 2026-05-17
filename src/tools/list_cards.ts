import { mcpFetch } from '../lib/mcp-fetch.js';

export const listCardsDefinition = {
  name: 'list_cards',
  description: 'List all virtual cards with their IDs, last four digits, expiry, balance, and status. Start here to find available cards. If no cards are returned, call create_card to issue a new one.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  annotations: {
    title: 'List Cards',
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function listCards(_args: Record<string, never>, jwt: string) {
  const res = await mcpFetch('/cards', jwt);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const { cards } = (await res.json()) as {
    cards: Array<{
      id: string;
      last4: string;
      expiry: string;
      balanceCents: number;
      spendLimitCents: number;
      status: string;
      sandbox?: boolean;
    }>;
  };

  if (cards.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No cards found.' }] };
  }

  const rows = cards.map((c) => {
    const tag = c.sandbox ? ' [TEST]' : '';
    return `• ID: ${c.id}${tag}  •••• ${c.last4}  Expires: ${c.expiry}  Balance: $${(c.balanceCents / 100).toFixed(2)}  Status: ${c.status}`;
  });

  return {
    content: [{ type: 'text' as const, text: rows.join('\n') }],
  };
}
