import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JWT } from './config.js';
import { createServer } from './server.js';
import { captureException, shutdownPostHog } from './lib/posthog.js';

async function main() {
  if (!JWT) {
    process.stderr.write('[agent-cards-mcp] Warning: AGENT_CARDS_JWT is not set\n');
  }
  const server = createServer(JWT);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[agent-cards-mcp] Server running on stdio\n');
}

process.on('SIGTERM', () => { shutdownPostHog().then(() => process.exit(0)); });
process.on('SIGINT', () => { shutdownPostHog().then(() => process.exit(0)); });

main().catch((err) => {
  captureException(err);
  process.stderr.write(`[agent-cards-mcp] Fatal: ${err.message}\n`);
  shutdownPostHog().then(() => process.exit(1));
});
