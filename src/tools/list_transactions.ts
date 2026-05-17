import { mcpFetch } from '../lib/mcp-fetch.js';

export const listTransactionsDefinition = {
  name: 'list_transactions',
  description: 'List transactions for a specific card. Returns amount, merchant, status, and timestamps. Use limit and status to filter results.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      card_id: { type: 'string', description: 'The card ID' },
      limit: { type: 'number', description: 'Max number of transactions to return (default 20)' },
      status: { type: 'string', description: 'Filter by transaction status (e.g. PENDING, SETTLED, DECLINED, REVERSED, EXPIRED, REFUNDED)' },
    },
    required: ['card_id'],
  },
  annotations: {
    title: 'List Transactions',
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function listTransactions(
  args: { card_id: string; limit?: number; status?: string },
  jwt: string,
) {
  const params = new URLSearchParams();
  params.set('limit', String(args.limit ?? 20));
  if (args.status) {
    params.set('status', args.status);
  }

  const res = await mcpFetch(`/cards/${args.card_id}/transactions?${params}`, jwt);

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const { transactions } = (await res.json()) as {
    transactions: Array<{
      id: string;
      amountCents: number;
      merchant: string;
      description: string;
      status: string;
      eventType: string;
      source: string;
      mcc: string;
      createdAt: string;
    }>;
  };

  if (transactions.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No transactions found.' }] };
  }

  const rows = transactions.map((t) =>
    `• ${t.createdAt}  $${(t.amountCents / 100).toFixed(2)}  ${t.merchant}  ${t.status}  ${t.description}`
  );

  return {
    content: [{ type: 'text' as const, text: rows.join('\n') }],
  };
}
