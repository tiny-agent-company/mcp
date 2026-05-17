# @agent-cards/mcp

Give your AI agent a debit card. AgentCard lets AI agents create and spend virtual debit cards — each with a fixed budget, real card credentials, and full MCP integration. Your agent can create a card, pay for things, check its balance, and auto-fill checkout forms — without ever needing your personal card.

## Quick Setup

The fastest way to connect your agent is through the CLI:

```bash
npx agent-cards signup    # create an account (one-time)
npx agent-cards setup-mcp # auto-configures Claude Code
```

That's it. Restart Claude Code and the tools are ready to use.

## Manual Setup

### HTTP (recommended)

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "agent-cards": {
      "url": "https://mcp.agentcard.sh/mcp",
      "headers": {
        "Authorization": "Bearer <your-jwt>"
      }
    }
  }
}
```

Get your JWT with `npx agent-cards login`, then find it in `~/.agent-cards/config.json`.

### stdio (local)

```json
{
  "mcpServers": {
    "agent-cards": {
      "command": "node",
      "args": ["/path/to/packages/mcp/dist/src/index.js"],
      "env": {
        "AGENT_CARDS_JWT": "<your-jwt>",
        "AGENT_CARDS_API_URL": "https://your-backend.example.com"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_cards` | List all virtual cards with balances, expiry, and status |
| `create_card` | Create a new virtual debit card with a fixed USD budget |
| `get_card_details` | Get decrypted PAN, CVV, expiry (may require human approval) |
| `check_balance` | Fast balance check without exposing credentials |
| `close_card` | Permanently close a virtual card |
| `list_transactions` | List transactions for a card with optional status filter |
| `approve_request` | Approve or deny a pending human-in-the-loop request |
| `submit_user_info` | Submit identity info for card issuance verification |
| `setup_payment_method` | Set up a payment method for funding cards |
| `remove_payment_method` | Remove a saved payment method |
| `pay_checkout` | Auto-detect and pay a checkout page using an AgentCard |
| `detect_checkout` | Detect checkout forms on the current browser tab |
| `fill_card` | Fill card credentials into a payment form in the browser |
| `start_support_chat` | Start a support conversation |
| `send_support_message` | Send a message in a support thread |
| `read_support_chat` | Read support conversation history |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | MCP Streamable HTTP transport |
| `GET` | `/health` | Health check (`{"ok":true}`) |
| `GET` | `/.well-known/mcp/server-card.json` | Auto-discovery metadata |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_CARDS_API_URL` | yes | Backend API URL |
| `AGENT_CARDS_JWT` | stdio only | User JWT (HTTP gets it from the `Authorization` header) |
| `PORT` | no | HTTP server port (default: `3002`) |

## Development

```bash
pnpm dev       # stdio mode
pnpm dev:http  # HTTP mode
pnpm build     # compile TypeScript
```
