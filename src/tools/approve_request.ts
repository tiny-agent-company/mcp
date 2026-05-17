import { mcpFetch } from '../lib/mcp-fetch.js';

export const approveRequestDefinition = {
  name: 'approve_request',
  description:
    'Resolve a pending approval request (approve or deny). Use this after get_card_details or create_card returns a 202 requiring approval. On approval, this tool automatically completes the follow-up action and returns the result.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      approval_id: { type: 'string', description: 'The approval request ID' },
      decision: {
        type: 'string',
        enum: ['approved', 'denied'],
        description: 'Whether to approve or deny the request',
      },
      action: {
        type: 'string',
        enum: ['card_details', 'transaction'],
        description: 'The original action type from the approval prompt',
      },
      resource_id: {
        type: 'string',
        description: 'Card ID (for card_details) or approval ID (for transaction)',
      },
    },
    required: ['approval_id', 'decision', 'action', 'resource_id'],
  },
  annotations: {
    title: 'Approve Request',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function approveRequest(
  args: {
    approval_id: string;
    decision: 'approved' | 'denied';
    action: 'card_details' | 'transaction';
    resource_id: string;
  },
  jwt: string,
) {
  // Resolve the approval
  const resolveRes = await mcpFetch(`/approvals/${args.approval_id}/resolve`, jwt, {
    method: 'POST',
    body: JSON.stringify({ decision: args.decision }),
  });

  if (!resolveRes.ok) {
    const errBody = await resolveRes.text();
    throw new Error(`Failed to resolve approval: ${resolveRes.status} ${errBody}`);
  }

  if (args.decision === 'denied') {
    return {
      content: [{ type: 'text' as const, text: 'Request denied. No action was taken.' }],
    };
  }

  // Follow-up: execute the approved action
  if (args.action === 'card_details') {
    const detailsRes = await mcpFetch(
      `/cards/${args.resource_id}/details/approved?approvalId=${args.approval_id}`,
      jwt,
    );

    if (!detailsRes.ok) {
      throw new Error(`API error ${detailsRes.status}: ${await detailsRes.text()}`);
    }

    const card = (await detailsRes.json()) as {
      id: string; pan: string; cvv: string; expiry: string;
      last4: string; balanceCents: number; status: string;
    };

    const text = [
      'Approved! Here are the card details:',
      `Card ID: ${card.id}`,
      `PAN: ${card.pan}`,
      `CVV: ${card.cvv}`,
      `Expiry: ${card.expiry}`,
      `Balance: $${(card.balanceCents / 100).toFixed(2)}`,
      `Status: ${card.status}`,
    ].join('\n');

    return { content: [{ type: 'text' as const, text }] };
  }

  if (args.action === 'transaction') {
    const createRes = await mcpFetch('/cards/create/approved', jwt, {
      method: 'POST',
      body: JSON.stringify({ approvalId: args.approval_id }),
    });

    if (!createRes.ok) {
      throw new Error(`API error ${createRes.status}: ${await createRes.text()}`);
    }

    const card = (await createRes.json()) as {
      id: string;
      last4: string;
      expiry: string;
      balanceCents: number;
      status: string;
    };

    const text = [
      'Approved! Card created successfully.',
      `Card ID: ${card.id}`,
      `Last 4: ${card.last4}`,
      `Expiry: ${card.expiry}`,
      `Balance: $${(card.balanceCents / 100).toFixed(2)}`,
      `Status: ${card.status}`,
    ].join('\n');

    return { content: [{ type: 'text' as const, text }] };
  }

  return {
    content: [{ type: 'text' as const, text: `Approved, but unknown action type: ${args.action}` }],
  };
}
