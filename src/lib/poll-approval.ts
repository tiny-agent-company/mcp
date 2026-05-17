import { mcpFetch } from './mcp-fetch.js';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

export async function pollApproval(
  approvalId: string,
  jwt: string,
): Promise<{ status: 'approved' | 'denied' | 'expired' }> {
  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    const res = await mcpFetch(`/approvals/${approvalId}/status`, jwt);

    if (!res.ok) {
      throw new Error(`Approval status check failed: ${res.status}`);
    }

    const { status } = (await res.json()) as { status: string };

    if (status === 'approved' || status === 'denied' || status === 'expired') {
      return { status };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { status: 'expired' };
}
