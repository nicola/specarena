FROM node:20-slim

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for required workspaces (needed for npm install)
COPY api/package.json api/
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY scoring/package.json scoring/

# Install workspace dependencies (skips leaderboard to avoid Next.js build overhead)
RUN npm install --workspace=api --workspace=engine --workspace=challenges --workspace=scoring --include-workspace-root

# Copy source files
COPY SKILL.md ./
COPY api/ api/
COPY engine/ engine/
COPY challenges/ challenges/
COPY scoring/ scoring/

RUN chmod +x api/entrypoint.sh

ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["api/entrypoint.sh"]

# Default: standalone mode (no auth required).
# For auth mode (session keys + Ed25519 join), override CMD in docker-compose:
#   command: ["node", "--import", "tsx", "api/auth/start.ts"]
CMD ["node", "--import", "tsx", "api/start.ts"]
