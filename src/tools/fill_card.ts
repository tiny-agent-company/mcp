import { extensionBridge, userIdFromJwt } from '../lib/extension-bridge.js';

export const fillCardDefinition = {
  name: 'fill_card',
  description:
    'Fill an existing AgentCard into the current checkout form. Use this when you already have a card and want to fill it into a different checkout page. Requires Chrome with the AgentCard Pay extension. If not installed, run `npx agent-cards extension install` and ask the user to load it in Chrome.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      card_id: {
        type: 'string',
        description: 'The AgentCard card ID to fill.',
      },
      tab_id: {
        type: 'number',
        description: 'Chrome tab ID. If omitted, uses the active tab.',
      },
    },
    required: ['card_id'],
  },
  annotations: {
    title: 'Fill Card',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export async function fillCard(
  args: { card_id: string; tab_id?: number },
  jwt: string
) {
  const result = await extensionBridge.sendRequest('fill_card', {
    card_id: args.card_id,
    tab_id: args.tab_id,
  }, userIdFromJwt(jwt));

  if (result.error) {
    return {
      content: [{ type: 'text' as const, text: `Fill failed: ${result.error}` }],
      isError: true,
    };
  }

  const lines = [`Fill status: ${result.status}`];
  if (result.fields_filled) {
    lines.push(`Fields filled: ${(result.fields_filled as string[]).join(', ')}`);
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
