import { mcpFetch } from '../lib/mcp-fetch.js';

export const setupPaymentMethodDefinition = {
  name: 'setup_payment_method',
  description:
    'Set up a payment method for future card creation. Returns a Stripe checkout URL that the user must open to save their card details. Once completed, the saved payment method will be used automatically when creating new cards.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  annotations: {
    title: 'Setup Payment Method',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function setupPaymentMethod(
  args: Record<string, never>,
  jwt: string,
) {
  const res = await mcpFetch('/payment-methods/setup', jwt, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const { checkoutUrl, stripeSessionId } = (await res.json()) as {
    checkoutUrl: string;
    stripeSessionId: string;
  };

  const text = [
    `Payment method setup session created.`,
    `Session ID: ${stripeSessionId}`,
    `Checkout URL: ${checkoutUrl}`,
    ``,
    `The user must open the checkout URL to save their payment method.`,
    `Once completed, their card will be used automatically for future transactions.`,
  ].join('\n');

  return { content: [{ type: 'text' as const, text }] };
}
