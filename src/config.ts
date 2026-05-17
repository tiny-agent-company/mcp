export const API_URL =
  process.env.AGENT_CARDS_API_URL ?? 'https://api.agentcard.sh';

export const JWT =
  process.env.AGENT_CARDS_JWT ?? '';

export const CARD_PAYMENT_SECRET =
  process.env.CARD_PAYMENT_SECRET ?? '';

export const JWT_SECRET =
  process.env.JWT_SECRET ?? '';

export const OAUTH_INTERNAL_SECRET =
  process.env.OAUTH_INTERNAL_SECRET ?? '';

export const MCP_BASE_URL =
  process.env.MCP_BASE_URL ?? 'http://localhost:3002';

export const CLIENT_URL =
  process.env.CLIENT_URL ?? 'https://agentcard.sh';
