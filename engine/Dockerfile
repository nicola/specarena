FROM node:20-slim

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json ./

# Copy package.json files for all workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY leaderboard/package.json leaderboard/

# Install all workspace dependencies
RUN npm ci --workspace=engine --workspace=challenges --include-workspace-root

# Copy engine + challenges source
COPY engine/ engine/
COPY challenges/ challenges/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "--import", "tsx", "engine/server.ts"]
