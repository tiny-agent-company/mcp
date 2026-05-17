import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { listCardsDefinition, listCards } from './tools/list_cards.js';
import { getCardDetailsDefinition, getCardDetails } from './tools/get_card_details.js';
import { checkBalanceDefinition, checkBalance } from './tools/check_balance.js';
import { closeCardDefinition, closeCard } from './tools/close_card.js';
import { createCardDefinition, createCard } from './tools/create_card.js';
import { startSupportChatDefinition, startSupportChat } from './tools/start_chat.js';
import { sendSupportMessageDefinition, sendSupportMessage } from './tools/send_chat_message.js';
import { readSupportChatDefinition, readSupportChat } from './tools/read_chat.js';
import { approveRequestDefinition, approveRequest } from './tools/approve_request.js';
import { submitUserInfoDefinition, submitUserInfo } from './tools/submit_user_info.js';
import { listTransactionsDefinition, listTransactions } from './tools/list_transactions.js';
import { setupPaymentMethodDefinition, setupPaymentMethod } from './tools/setup_payment_method.js';
import { removePaymentMethodDefinition, removePaymentMethod } from './tools/remove_payment_method.js';
import { payCheckoutDefinition, payCheckout } from './tools/pay_checkout.js';
import { detectCheckoutDefinition, detectCheckout } from './tools/detect_checkout.js';
import { fillCardDefinition, fillCard } from './tools/fill_card.js';

const tools = [
  listCardsDefinition,
  getCardDetailsDefinition,
  checkBalanceDefinition,
  closeCardDefinition,
  createCardDefinition,
  startSupportChatDefinition,
  sendSupportMessageDefinition,
  readSupportChatDefinition,
  approveRequestDefinition,
  submitUserInfoDefinition,
  listTransactionsDefinition,
  setupPaymentMethodDefinition,
  removePaymentMethodDefinition,
  payCheckoutDefinition,
  detectCheckoutDefinition,
  fillCardDefinition,
];

export function createServer(jwt: string): Server {
  const server = new Server(
    { name: 'AgentCard', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Log tool invocation for AI audit trail (sanitize sensitive fields)
    const sanitizedArgs = { ...args } as Record<string, unknown>;
    if (sanitizedArgs.card_id) sanitizedArgs.card_id = '***';
    process.stderr.write(`[agent-cards-mcp] tool=${name} args=${JSON.stringify(sanitizedArgs)}\n`);

    try {
      switch (name) {
        case 'list_cards':
          return await listCards(args as Record<string, never>, jwt);
        case 'get_card_details':
          return await getCardDetails(args as { card_id: string }, jwt);
        case 'check_balance':
          return await checkBalance(args as { card_id: string }, jwt);
        case 'close_card':
          return await closeCard(args as { card_id: string }, jwt);
        case 'create_card':
          return await createCard(
            args as { amount_cents: number; sandbox?: boolean },
            jwt
          );
        case 'start_support_chat':
          return await startSupportChat(args as { message: string }, jwt);
        case 'send_support_message':
          return await sendSupportMessage(args as { conversation_id: string; message: string }, jwt);
        case 'read_support_chat':
          return await readSupportChat(args as { conversation_id: string }, jwt);
        case 'approve_request':
          return await approveRequest(
            args as { approval_id: string; decision: 'approved' | 'denied'; action: 'card_details' | 'transaction'; resource_id: string },
            jwt
          );
        case 'submit_user_info':
          return await submitUserInfo(
            args as { first_name: string; last_name: string; date_of_birth: string; phone_number: string; terms_accepted: boolean },
            jwt
          );
        case 'list_transactions':
          return await listTransactions(
            args as { card_id: string; limit?: number; status?: string },
            jwt
          );
        case 'setup_payment_method':
          return await setupPaymentMethod(
            args as Record<string, never>,
            jwt
          );
        case 'remove_payment_method':
          return await removePaymentMethod(
            args as { payment_method_id: string },
            jwt
          );
        case 'pay_checkout':
          return await payCheckout(
            args as { url?: string; amount_cents?: number; tab_id?: number },
            jwt
          );
        case 'detect_checkout':
          return await detectCheckout(
            args as { tab_id?: number },
            jwt
          );
        case 'fill_card':
          return await fillCard(
            args as { card_id: string; tab_id?: number },
            jwt
          );
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  return server;
}
