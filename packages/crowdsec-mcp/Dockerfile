# syntax=docker/dockerfile:1

# Digest pinning and updates are handled by Renovate (see renovate.json).
# Keep a single base stage so Renovate only has one FROM line to update.
FROM node:26-alpine AS node

FROM node AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Node 26 no longer ships Corepack.
RUN npm install -g pnpm@12.11.2 --ignore-scripts

WORKDIR /repo

# Install from the lockfile only, so this layer is cached until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .npmrc ./
COPY packages/crowdsec-client/package.json packages/crowdsec-client/
COPY packages/crowdsec-mcp/package.json packages/crowdsec-mcp/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --store-dir /pnpm/store

COPY packages/crowdsec-client packages/crowdsec-client
COPY packages/crowdsec-mcp packages/crowdsec-mcp

RUN pnpm --filter crowdsec-mcp... build

# Produce a self-contained directory with production dependencies only.
# The workspace protocol (crowdsec-client: workspace:^) requires pnpm deploy.
RUN pnpm --filter crowdsec-mcp --prod deploy --legacy /out
RUN find /out -type f \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \) -delete

FROM node AS runtime

ENV NODE_ENV=production

# npm is only needed to install pnpm in the build stage.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app
COPY --from=build --chown=node:node /out ./

USER node
EXPOSE 3939

# The HTTP transport is optional; stdio deployments are considered healthy as
# long as the process is running. For HTTP, probe the configured port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "if ((process.env.CROWDSEC_MCP_TRANSPORT || 'stdio') !== 'http') process.exit(0); const net = require('node:net'); let host = process.env.CROWDSEC_MCP_HTTP_HOST || '127.0.0.1'; if (host === '0.0.0.0') host = '127.0.0.1'; const port = Number(process.env.CROWDSEC_MCP_HTTP_PORT || 3939); const socket = net.connect(port, host, () => { socket.end(); process.exit(0); }); socket.on('error', () => process.exit(1)); socket.setTimeout(4000, () => { socket.destroy(); process.exit(1); });"

ENTRYPOINT ["node", "dist/index.js"]
