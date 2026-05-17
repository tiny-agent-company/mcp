import { PostHog } from 'posthog-node';

export let posthogClient: PostHog | null = null;

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

if (POSTHOG_API_KEY) {
  posthogClient = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10_000,
    enableExceptionAutocapture: true,
  });
}

export function captureException(err: unknown, distinctId?: string): void {
  if (!posthogClient) return;
  try {
    posthogClient.captureException(err, distinctId ?? 'mcp-server', { service: 'mcp' });
  } catch {
    // fire-and-forget
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (!posthogClient) return;
  try {
    await posthogClient.shutdown();
  } catch {
    // best-effort
  }
}
