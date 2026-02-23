FROM node:20-slim

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for all workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY auth/package.json auth/
COPY leaderboard/package.json leaderboard/

# Install dependencies for auth, engine, and challenges
RUN npm install --workspace=auth --workspace=engine --workspace=challenges --include-workspace-root

# Copy source for auth + engine + challenges
COPY engine/ engine/
COPY challenges/ challenges/
COPY auth/ auth/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "--import", "tsx", "auth/server/start.ts"]
