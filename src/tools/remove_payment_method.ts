import { mcpFetch } from '../lib/mcp-fetch.js';

export const removePaymentMethodDefinition = {
  name: 'remove_payment_method',
  description:
    'Remove a saved payment method. This detaches it from Stripe permanently. Use list_payment_methods or the list from setup_payment_method status to find the payment_method_id.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      payment_method_id: {
        type: 'string',
        description: 'The Stripe payment method ID to remove (e.g. pm_xxx)',
      },
    },
    required: ['payment_method_id'],
  },
  annotations: {
    title: 'Remove Payment Method',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function removePaymentMethod(
  args: { payment_method_id: string },
  jwt: string,
) {
  const res = await mcpFetch(`/payment-methods/${args.payment_method_id}`, jwt, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Payment method ${args.payment_method_id} has been removed successfully.`,
      },
    ],
  };
}
