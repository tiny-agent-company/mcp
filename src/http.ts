/**
 * Deployed HTTP MCP server with OAuth 2.1 support.
 * Supports both OAuth tokens (Claude.ai) and legacy JWTs (CLI users).
 */
import 'dotenv/config';
import { createHmac } from 'crypto';
import express from 'express';
import { captureException, shutdownPostHog } from './lib/posthog.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { createServer } from './server.js';
import { AgentCardOAuthProvider } from './auth/provider.js';
import { oauthFetch } from './auth/oauth-fetch.js';
import { JWT_SECRET, MCP_BASE_URL, CLIENT_URL } from './config.js';
import { extensionBridge } from './lib/extension-bridge.js';

const PORT = Number(process.env.PORT ?? 3002);

const provider = new AgentCardOAuthProvider();

const app = express();
app.set('trust proxy', 1);

// OAuth endpoints (auto-creates /authorize, /token, /register, /revoke, /.well-known/*)
app.use(mcpAuthRouter({
  provider,
  issuerUrl: new URL(MCP_BASE_URL),
  resourceServerUrl: new URL(`${MCP_BASE_URL}/mcp`),
  serviceDocumentationUrl: new URL(CLIENT_URL),
  resourceName: 'AgentCard MCP Server',
}));

// --- Custom OAuth form handlers ---

app.post('/oauth/submit-email', express.json(), async (req, res) => {
  const { email, pendingAuthId } = req.body;
  if (!email || !pendingAuthId) {
    res.status(400).json({ error: 'Missing email or pendingAuthId' });
    return;
  }

  const backendRes = await oauthFetch('/oauth/send-magic-link', {
    method: 'POST',
    body: { email, pendingAuthId },
  });

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ error: 'Failed to send magic link' }));
    res.status(backendRes.status).json(err);
    return;
  }

  res.json({ ok: true });
});

app.get('/oauth/poll', async (req, res) => {
  const pendingId = req.query.pending as string;
  if (!pendingId) {
    res.status(400).json({ error: 'Missing pending parameter' });
    return;
  }

  const backendRes = await oauthFetch(`/oauth/pending/${pendingId}`);
  if (!backendRes.ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const pending = await backendRes.json();
  res.json({
    status: pending.userId ? 'verified' : 'pending',
  });
});

app.get('/oauth/complete', async (req, res) => {
  const pendingId = req.query.pending as string;
  if (!pendingId) {
    res.status(400).send('Missing pending parameter');
    return;
  }

  const backendRes = await oauthFetch(`/oauth/pending/${pendingId}`);
  if (!backendRes.ok) {
    res.status(400).send('Invalid pending auth');
    return;
  }

  const pending = await backendRes.json();
  if (!pending.userId) {
    res.status(400).send('Authorization not completed — please verify via email first');
    return;
  }

  if (new Date(pending.expiresAt) < new Date()) {
    res.status(400).send('Authorization request expired');
    return;
  }

  // Create authorization code
  const code = crypto.randomUUID();
  const codeRes = await oauthFetch('/oauth/codes', {
    method: 'POST',
    body: {
      code,
      clientId: pending.clientId,
      userId: pending.userId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scope: pending.scopes ? JSON.parse(pending.scopes).join(' ') : undefined,
    },
  });

  if (!codeRes.ok) {
    res.status(500).send('Failed to create authorization code');
    return;
  }

  // Redirect to client's redirect_uri with code and state
  const redirectUrl = new URL(pending.redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (pending.state) {
    redirectUrl.searchParams.set('state', pending.state);
  }

  res.redirect(redirectUrl.toString());
});

// Favicon for Claude.ai connector icon (SVG + pre-rendered 64x64 PNG)
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="40" fill="#111111"/>
  <rect x="20" y="43" width="160" height="114" rx="12" stroke="#FFFFFF" stroke-width="5" fill="none"/>
  <rect x="58" y="68" width="84" height="64" stroke="#FFFFFF" stroke-width="5" fill="none"/>
  <line x1="58" y1="103.5" x2="142" y2="103.5" stroke="#FFFFFF" stroke-width="5"/>
  <line x1="99.5" y1="68" x2="99.5" y2="103.5" stroke="#FFFFFF" stroke-width="5"/>
</svg>`;

const FAVICON_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAQKADAAQAAAABAAAAQAAAAABlmWCKAAAEKUlEQVR4Ae1bSyh9QRj/zrnXI+RRFooUElkpr9hSRFJK2dlYsLZRNjZKsZetlVJKHlFsvZWVSLLB1iMi7/ubf3O795g5hv+EM3O/0rln5htnfr/5zsw3c77PeYsISQRVGxsbtLS0RNvb23RyckI3Nzf08vIiafG7xaFQiDIzM6mkpIRqa2uptbWV6uvryXEcacccGQFzc3M0OjpKR0dH0sZBqCgrK6PBwUHq6OgQdvcDAbe3t9Tf30+Li4vCBkEtbGtro4mJCcrIyIiDEEfA2dkZdXd308HBQZySKTcVFRU0PT1NBQUFUUhRAjDyLS0txoLniEHC8vJy1BJcXgGzN3XkOUZcgRFYuTACMOGZ9s5zgKIrsAIzxHl9fX1raGgI/GwvAupXhtVhfX2dXKzzQV/q/IDK6oAZ2EN5eXnDu7u7Mj2jy7OzsymUmpo6fHFxYTRQGTh4uqFI5fDDw4NMx+jy+/t7cnJzc99UfPuIpfj61H+JKYysyqBi7xD2A19aWkpDQ0PU2NhI6enpfwnjp325u7ujtbU1GhkZoePjY6E+sDs5OTnC3WB1dTXNzs5ScnIyrays0Pn5OYHZIAh2f/n5+dTc3EyPj4/U2dlJsoleSIDrumz7m5WVRe3t7XR4eBgE3B/6WF5eTvPz83R9fc22xxGf54NO1BWOramrq6Pi4mIaGxsLLHjgwcCNj48zLMAkEiEBRUVFTHdvb0/UJlBl3PQ5Jm/nhQQkJSUxvefnZ69+4O45Bo7JC0BIgFfJ5PuwDnCYdeEn/KRgndexKmkhABMMDk5/UnDgubm5+d+P1EIA78Xq6qrU6eA6sdfe3l46PT1lDktsud9vOGdNTU1+Kl+q00rAzMwM4U9Venp6aH9/n3mbqm26urq0EmD9JJggQNX0TNVLWICpI6uKK2EBqkyZqme9BWh1hPr6+tgBiqq1pKSkED7KTE1NqTZhJz3KygqKWgmAm1pYWKjw2H8qCLZIS0tjQQyqjUCaTtFKwMDAwJdc4e8AgSs8OTn5nabCNtbPAQkChHZhUWHCAiwabCFU6y1A6zKIJaqyslLItK5C+Bo6RSsBOKvTeV6nE6jsf2khYGtrS7uLKuswL1f5/M11/a5aCMD5PIINgijWT4JCAp6enthghsNaDORXDYNj4Ji8nRESgI8VkKqqKq9+4O4R6AHhmLwAjA+QWFhYoKurK2mAhJAAsGR1iAw3E9ODpIAzESaHHJvLy0s+6NKrLsdD+oBfqEAQmIsEI1sFgWBuTU2NrfjZyuAimchWQZSJi7w6JA/YJsAM7C4CnJBXZ5sAM7AzVxhJhTa9CsDKEykTaXPc9JFRiaRC5NWZKjxxMjZ7NG43iIxKJBWa+DoAE7DFZo1ioKOvgHfUrU2ejiUCR11ILUOi4c7OTqDS5+HgYdQ/S59/B7ewsNYp7AU6AAAAAElFTkSuQmCC', 'base64');

app.get('/favicon.svg', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(FAVICON_SVG);
});

app.get('/favicon.ico', (_req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(FAVICON_PNG);
});

app.get('/favicon.png', (_req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(FAVICON_PNG);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// OAuth Protected Resource metadata (RFC 9728) — required by ChatGPT
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: `${MCP_BASE_URL}/mcp`,
    authorization_servers: [MCP_BASE_URL],
    scopes_supported: [],
  });
});

// OpenAI domain verification — serves challenge token as plain text
app.get('/.well-known/openai-apps-challenge', (_req, res) => {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN ?? '';
  res.setHeader('Content-Type', 'text/plain');
  res.send(token);
});

// MCP server-card.json for auto-discovery
app.get('/.well-known/mcp/server-card.json', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    name: 'AgentCard',
    description: 'Virtual debit cards for AI agents with MCP-native spending controls and per-task budget limits',
    version: '1.0.0',
    url: `${MCP_BASE_URL}/mcp`,
    transport: 'http',
    authentication: {
      type: 'oauth2',
      authorization_url: `${MCP_BASE_URL}/authorize`,
      token_url: `${MCP_BASE_URL}/token`,
      registration_url: `${MCP_BASE_URL}/register`,
    },
    tools: [
      { name: 'list_cards', description: 'List all virtual cards with balances, expiry, and status' },
      { name: 'create_card', description: 'Create a new virtual debit card with a fixed USD budget' },
      { name: 'get_card_details', description: 'Get decrypted PAN, CVV, expiry (requires human approval)' },
      { name: 'check_balance', description: 'Fast balance check without exposing credentials' },
      { name: 'close_card', description: 'Permanently close a virtual card' },
      { name: 'get_funding_status', description: 'Poll card creation status after Stripe payment' },
      { name: 'start_support_chat', description: 'Start a support conversation' },
      { name: 'send_support_message', description: 'Send a message in a support thread' },
      { name: 'read_support_chat', description: 'Read support conversation history' },
    ],
    homepage: CLIENT_URL,
    repository: 'https://github.com/agent-cards/mcp',
    keywords: ['mcp', 'virtual-card', 'ai-agent', 'payments', 'mastercard', 'fintech'],
    logo: `${CLIENT_URL}/card.png`,
  });
});

// --- MCP endpoint with dual auth ---

/**
 * Detect legacy JWT tokens by checking for JWT structure (3 dot-separated base64 parts).
 */
function isLegacyJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Mint an internal JWT for a userId (used when OAuth token maps to a user).
 */
function mintInternalJwt(userId: string): string {
  // Use jose's sync SignJWT equivalent — but jose is async-only.
  // For simplicity, use a minimal JWT approach with jsonwebtoken-compatible output.
  // Since we already have jose as a dep, we'll use a sync approach.
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

app.post('/mcp', express.json({ limit: '1mb' }), async (req, res) => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({
      error: 'Missing Authorization: Bearer <token> header',
      hint: 'Use OAuth via /.well-known/oauth-authorization-server or provide a JWT',
    });
    return;
  }

  let userJwt: string;

  if (isLegacyJwt(token)) {
    // Backward compat: CLI users with raw JWTs
    userJwt = token;
  } else {
    // OAuth token: verify -> get userId -> mint internal JWT
    try {
      const authInfo = await provider.verifyAccessToken(token);
      const userId = (authInfo.extra as { userId: string })?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Invalid token: no associated user' });
        return;
      }
      userJwt = mintInternalJwt(userId);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  }

  const mcpServer = createServer(userJwt);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — new server per request
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Handle DELETE and GET for MCP (for SSE/session management)
app.delete('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Session management not supported in stateless mode' });
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'SSE transport not supported. Use POST /mcp with Streamable HTTP.' });
});

// Generic error handler — captures to PostHog and returns JSON
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  captureException(err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const httpServer = app.listen(PORT, () => {
  process.stderr.write(`[agent-cards-mcp] HTTP server listening on port ${PORT}\n`);
  process.stderr.write(`[agent-cards-mcp] Endpoint: POST http://localhost:${PORT}/mcp\n`);
  process.stderr.write(`[agent-cards-mcp] OAuth: ${MCP_BASE_URL}/.well-known/oauth-authorization-server\n`);
});

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[agent-cards-mcp] Unhandled rejection: ${err}\n`);
  captureException(err);
});
process.on('uncaughtException', (err) => {
  process.stderr.write(`[agent-cards-mcp] Uncaught exception: ${err}\n`);
  captureException(err);
});
process.on('SIGTERM', () => { shutdownPostHog().then(() => process.exit(0)); });

// Attach WebSocket upgrade handler for Chrome extension relay
extensionBridge.attachToHttpServer(httpServer, JWT_SECRET);
