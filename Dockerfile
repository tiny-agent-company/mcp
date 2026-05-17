FROM node:20-slim

WORKDIR /app

# Copy root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy mcp package
COPY packages/mcp/ packages/mcp/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && \
    pnpm install --filter mcp --frozen-lockfile

# Build
RUN pnpm --filter mcp build

EXPOSE 8080
ENV PORT=8080

CMD ["node", "packages/mcp/dist/http.js"]
