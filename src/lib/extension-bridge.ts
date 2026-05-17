import { WebSocketServer, WebSocket } from 'ws';
import { createHmac } from 'crypto';
import { randomUUID } from 'crypto';
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';

const WS_PORT = Number(process.env.AGENTCARD_WS_PORT) || 7681;
const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 60; // retry for up to 5 minutes

/**
 * Decode a JWT payload without verifying signature.
 * Signature is already verified at the HTTP layer before reaching here.
 */
export function userIdFromJwt(jwt: string): string {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (!payload.userId) throw new Error('JWT missing userId');
  return payload.userId;
}

/**
 * Verify a JWT signature using HMAC-SHA256.
 * Returns the decoded payload if valid, throws otherwise.
 */
function verifyJwt(token: string, secret: string): { userId: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  if (signature !== expected) throw new Error('Invalid JWT signature');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired');
  }
  return decoded;
}

/**
 * Multi-tenant WebSocket bridge for the Chrome extension.
 *
 * In stdio mode: runs a local WebSocket server on 127.0.0.1:7681,
 * registers connections under the key "local".
 *
 * In HTTP mode: handles WebSocket upgrades at /ws/extension,
 * authenticates via JWT query param, registers per userId.
 */
class ExtensionBridge {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WebSocket>();
  private listening = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private httpMode = false;
  private pending = new Map<
    string,
    {
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    // Only start local WS server if NOT in HTTP mode.
    // HTTP mode is activated by calling attachToHttpServer().
    // We defer the local server start — if attachToHttpServer is called
    // before the event loop tick, we skip local mode entirely.
    setTimeout(() => {
      if (!this.httpMode) {
        this.startLocalServer();
      }
    }, 0);
  }

  /**
   * Start a local WebSocket server for stdio mode.
   * Registers all connections under the key "local".
   */
  private startLocalServer(): void {
    if (this.wss) {
      try { this.wss.close(); } catch { /* ignore */ }
      this.wss = null;
    }

    this.wss = new WebSocketServer({ host: '127.0.0.1', port: WS_PORT });

    this.wss.on('connection', (ws) => {
      process.stderr.write('[agent-cards-mcp] Extension bridge connected (local)\n');
      this.registerClient('local', ws);
    });

    this.wss.on('listening', () => {
      this.listening = true;
      this.retryCount = 0;
      process.stderr.write(`[agent-cards-mcp] Extension bridge listening on ws://127.0.0.1:${WS_PORT}\n`);
    });

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      this.listening = false;
      if (err.code === 'EADDRINUSE') {
        process.stderr.write(`[agent-cards-mcp] Port ${WS_PORT} in use, retrying in ${RETRY_INTERVAL_MS / 1000}s (attempt ${this.retryCount + 1}/${MAX_RETRIES})…\n`);
        this.scheduleRetry();
      } else {
        process.stderr.write(`[agent-cards-mcp] Extension bridge failed to start: ${err.message}\n`);
      }
    });
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    if (this.retryCount >= MAX_RETRIES) {
      process.stderr.write(`[agent-cards-mcp] Giving up on port ${WS_PORT} after ${MAX_RETRIES} retries\n`);
      return;
    }
    this.retryCount++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.startLocalServer();
    }, RETRY_INTERVAL_MS);
  }

  /**
   * Register a WebSocket client for a given userId.
   * Cleans up any existing connection for the same userId.
   */
  registerClient(userId: string, ws: WebSocket): void {
    // Close old connection for same user
    const existing = this.clients.get(userId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close(1000, 'Replaced by new connection');
    }

    this.clients.set(userId, ws);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleResponse(msg);
      } catch { /* ignore parse errors */ }
    });

    ws.on('close', () => {
      process.stderr.write(`[agent-cards-mcp] Extension disconnected: ${userId}\n`);
      if (this.clients.get(userId) === ws) {
        this.clients.delete(userId);
      }
    });

    ws.on('error', (err) => {
      process.stderr.write(`[agent-cards-mcp] WebSocket error (${userId}): ${err.message}\n`);
    });
  }

  /**
   * Attach to an HTTP server to handle WebSocket upgrades at /ws/extension.
   * Authenticates via ?token= JWT query param.
   */
  attachToHttpServer(server: HttpServer, jwtSecret: string): void {
    this.httpMode = true;

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? '', `http://${request.headers.host}`);

      if (url.pathname !== '/ws/extension') {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get('token');
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let userId: string;
      try {
        const payload = verifyJwt(token, jwtSecret);
        userId = payload.userId;
      } catch (err) {
        process.stderr.write(`[agent-cards-mcp] WS auth failed: ${(err as Error).message}\n`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        process.stderr.write(`[agent-cards-mcp] Extension connected: ${userId}\n`);
        this.registerClient(userId, ws);
      });
    });
  }

  get isConnected(): boolean {
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  async sendRequest(
    type: string,
    params: Record<string, unknown> = {},
    userId?: string,
    timeoutMs = 30000
  ): Promise<Record<string, unknown>> {
    // Look up client: try userId first, fall back to "local"
    const key = userId ?? 'local';
    let client = this.clients.get(key);
    if (!client || client.readyState !== WebSocket.OPEN) {
      // Fall back to "local" if specific userId not found
      if (key !== 'local') {
        client = this.clients.get('local');
      }
    }

    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error(
        [
          'AgentCard Pay Chrome extension is not connected.',
          '',
          'This tool requires the AgentCard Pay Chrome extension to fill checkout forms in the browser.',
          '',
          'To install, run:',
          '  npx agent-cards extension install',
          '',
          'This downloads the extension to ~/.agent-cards/chrome-extension/.',
          'Then the user needs to load it in Chrome:',
          '  1. Open chrome://extensions',
          '  2. Enable Developer mode (top-right toggle)',
          '  3. Click "Load unpacked" and select ~/.agent-cards/chrome-extension/',
          '  4. Sign in to the extension with their AgentCard account',
          '',
          'If already installed, make sure Chrome is open and the extension is signed in.',
          '',
          'More info: https://agentcard.sh/pay',
        ].join('\n')
      );
    }

    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${type} timed out`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      client!.send(JSON.stringify({ id, type, params }));
    });
  }

  private handleResponse(message: {
    id: string;
    result?: Record<string, unknown>;
    error?: { code: string; message: string; approvalId?: string };
  }): void {
    const p = this.pending.get(message.id);
    if (!p) return;

    clearTimeout(p.timer);
    this.pending.delete(message.id);

    if (message.error) {
      if (message.error.code === 'APPROVAL_REQUIRED' && message.error.approvalId) {
        const err = new ApprovalRequiredBridgeError(
          message.error.message || 'Approval required',
          message.error.approvalId,
        );
        p.reject(err);
      } else {
        p.reject(new Error(message.error.message || 'Extension error'));
      }
    } else {
      p.resolve(message.result || {});
    }
  }
}

/**
 * Error thrown when the extension returns an APPROVAL_REQUIRED response.
 * Carries the approvalId so callers can prompt for inline approval.
 */
export class ApprovalRequiredBridgeError extends Error {
  constructor(message: string, public readonly approvalId: string) {
    super(message);
    this.name = 'ApprovalRequiredBridgeError';
  }
}

// Singleton — defers local WebSocket server start to allow HTTP mode activation
export const extensionBridge = new ExtensionBridge();
