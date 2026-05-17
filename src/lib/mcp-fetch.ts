import { randomUUID } from 'crypto';
import { API_URL } from '../config.js';

/**
 * Fetch wrapper that adds AI audit headers (X-Caller-Type, X-Correlation-ID)
 * to every MCP → backend API call for audit trail compliance.
 */
export async function mcpFetch(
  path: string,
  jwt: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    correlationId?: string;
  } = {},
): Promise<Response> {
  const correlationId = options.correlationId ?? randomUUID();
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Caller-Type': 'mcp-agent',
      'X-Correlation-ID': correlationId,
      'X-Approval-Channel': 'inline_mcp',
      'x-platform': 'mcp',
      'x-caller-context': 'unidentified',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: options.body } : {}),
  });

  // Guard against non-JSON responses (e.g. HTML 404 from Express, proxy error pages)
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error(
      `API at ${url} returned non-JSON response (HTTP ${res.status}, ${ct || 'no content-type'}). ` +
      `Check that AGENT_CARDS_API_URL is set to the backend URL (e.g. https://api.agentcard.sh).`,
    );
  }

  return res;
}
