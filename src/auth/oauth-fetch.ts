import { API_URL, OAUTH_INTERNAL_SECRET } from '../config.js';

/**
 * Fetch wrapper for MCP -> Backend OAuth internal API calls.
 * Uses X-OAuth-Secret header for authentication.
 */
export function oauthFetch(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const url = `${API_URL}${path}`;

  return fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'X-OAuth-Secret': OAUTH_INTERNAL_SECRET,
      'x-platform': 'mcp',
      'x-caller-context': 'unidentified',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}
