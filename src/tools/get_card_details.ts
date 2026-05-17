import { mcpFetch } from '../lib/mcp-fetch.js';

export const getCardDetailsDefinition = {
  name: 'get_card_details',
  description: 'Get decrypted PAN, CVV, expiry, and current balance for a specific card. Use this only when you need to fill in a payment form — prefer check_balance if you only need the balance. May require human approval before returning credentials. If approval is required, prompt the user and then call approve_request. Card details are encrypted at rest with AES-256-GCM.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      card_id: { type: 'string', description: 'The card ID' },
    },
    required: ['card_id'],
  },
  annotations: {
    title: 'Get Card Details',
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function getCardDetails(args: { card_id: string }, jwt: string) {
  const res = await mcpFetch(`/cards/${args.card_id}/details`, jwt);

  if (res.status === 202) {
    const body = (await res.json()) as { approvalId: string; message: string };

    const text = [
      'Approval required to access card details.',
      `Ask the user for approval, then call approve_request with:`,
      `  approval_id: "${body.approvalId}"`,
      `  decision: "approved" (or "denied")`,
      `  action: "card_details"`,
      `  resource_id: "${args.card_id}"`,
    ].join('\n');

    return { content: [{ type: 'text' as const, text }] };
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const card = (await res.json()) as {
    id: string;
    pan: string;
    cvv: string;
    expiry: string;
    last4: string;
    balanceCents: number;
    status: string;
    sandbox?: boolean;
  };

  const lines: string[] = [];
  if (card.sandbox) {
    lines.push('🧪 TEST CARD (sandbox funds, not chargeable at real merchants).', '');
  }
  lines.push(
    `Card ID: ${card.id}`,
    `PAN: ${card.pan}`,
    `CVV: ${card.cvv}`,
    `Expiry: ${card.expiry}`,
    `Balance: $${(card.balanceCents / 100).toFixed(2)}`,
    `Status: ${card.status}`,
    '',
    'Billing address (use this for online purchases):',
    '  2261 Market Street #4242',
    '  San Francisco, CA 94114, US',
  );

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
