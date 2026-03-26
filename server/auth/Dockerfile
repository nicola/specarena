FROM node:20-slim

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for required workspaces (needed for npm install)
COPY server/package.json server/
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY scoring/package.json scoring/

# Install workspace dependencies (skips leaderboard to avoid Next.js build overhead)
RUN npm install --workspace=server --workspace=engine --workspace=challenges --workspace=scoring --include-workspace-root

# Copy source files
COPY SKILL.md ./
COPY server/ server/
COPY engine/ engine/
COPY challenges/ challenges/
COPY scoring/ scoring/

RUN chmod +x server/entrypoint.sh

ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["server/entrypoint.sh"]
CMD ["node", "--import", "tsx", "server/auth/start.ts"]
