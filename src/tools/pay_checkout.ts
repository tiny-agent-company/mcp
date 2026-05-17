import { extensionBridge, userIdFromJwt, ApprovalRequiredBridgeError } from '../lib/extension-bridge.js';

export const payCheckoutDefinition = {
  name: 'pay_checkout',
  description:
    'Auto-fill a checkout page with an AgentCard virtual debit card. Creates or reuses a card, then fills the payment form (card number, expiry, CVC, email, billing address) via the AgentCard Pay Chrome extension. Requires Chrome with the extension installed and signed in. If the extension is not installed, run `npx agent-cards extension install` to download it, then ask the user to load it in Chrome via chrome://extensions (Load unpacked from ~/.agent-cards/chrome-extension/).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'Navigate to this checkout URL first, then pay. If omitted, uses the active Chrome tab.',
      },
      amount_cents: {
        type: 'number',
        description: 'Amount in cents. If omitted, auto-detects from the checkout page.',
      },
      tab_id: {
        type: 'number',
        description: 'Chrome tab ID. If omitted, uses the active tab.',
      },
    },
    required: [],
  },
  annotations: {
    title: 'Pay Checkout',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export async function payCheckout(
  args: { url?: string; amount_cents?: number; tab_id?: number },
  jwt: string
) {
  let result: Record<string, unknown>;
  try {
    result = await extensionBridge.sendRequest('pay_checkout', {
      url: args.url,
      amount_cents: args.amount_cents,
      tab_id: args.tab_id,
    }, userIdFromJwt(jwt));
  } catch (err) {
    if (err instanceof ApprovalRequiredBridgeError) {
      const text = [
        'Approval required to create a virtual card for this checkout.',
        `Ask the user for approval, then call approve_request with:`,
        `  approval_id: "${err.approvalId}"`,
        `  decision: "approved" (or "denied")`,
        `  action: "transaction"`,
        `  resource_id: "${err.approvalId}"`,
        '',
        'After approval, call pay_checkout again to complete the payment.',
      ].join('\n');
      return { content: [{ type: 'text' as const, text }] };
    }
    throw err;
  }

  if (result.error) {
    return {
      content: [{ type: 'text' as const, text: `Payment failed: ${result.error}` }],
      isError: true,
    };
  }

  const lines = [
    'Card filled successfully.',
    `  Card ID: ${result.card_id}`,
    `  Last 4: ${result.last4}`,
    `  Amount: $${((result.amount_cents as number) / 100).toFixed(2)}`,
    `  Fill status: ${result.status}`,
  ];
  if (result.fields_filled) {
    lines.push(`  Fields filled: ${(result.fields_filled as string[]).join(', ')}`);
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
