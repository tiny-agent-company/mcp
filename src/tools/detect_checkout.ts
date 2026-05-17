import { extensionBridge, userIdFromJwt } from '../lib/extension-bridge.js';

export const detectCheckoutDefinition = {
  name: 'detect_checkout',
  description:
    'Check if the current browser tab is a checkout page. Returns detection confidence, detected amount, and scoring signals. Requires Chrome with the AgentCard Pay extension installed. If not installed, run `npx agent-cards extension install` and ask the user to load it in Chrome.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tab_id: {
        type: 'number',
        description: 'Chrome tab ID. If omitted, uses the active tab.',
      },
    },
    required: [],
  },
  annotations: {
    title: 'Detect Checkout',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export async function detectCheckout(
  args: { tab_id?: number },
  jwt: string
) {
  const result = await extensionBridge.sendRequest('detect_checkout', {
    tab_id: args.tab_id,
  }, userIdFromJwt(jwt));

  const lines = [
    `Checkout detected: ${result.is_checkout ? 'Yes' : 'No'}`,
    `Confidence: ${((result.confidence as number) * 100).toFixed(0)}%`,
  ];
  if (result.detected_amount_cents) {
    lines.push(`Detected amount: $${((result.detected_amount_cents as number) / 100).toFixed(2)}`);
  }
  if (result.signals) {
    lines.push('\nSignals:');
    for (const signal of result.signals as Array<Record<string, unknown>>) {
      const icon = signal.matched ? '+' : '-';
      lines.push(`  ${icon} ${signal.name} (weight: ${signal.weight})${signal.detail ? ` — ${signal.detail}` : ''}`);
    }
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
