FROM node:20-slim

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for all workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY leaderboard/package.json leaderboard/

# Install all workspace dependencies (no lockfile — npm install resolves fresh)
RUN npm install --workspace=engine --workspace=challenges --include-workspace-root

# Copy engine + challenges source
COPY SKILL.md ./
COPY engine/ engine/
COPY challenges/ challenges/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "--import", "tsx", "engine/server/start.ts"]
