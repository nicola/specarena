FROM node:20-slim AS base

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json ./

# Copy package.json files for all workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY leaderboard/package.json leaderboard/

# Install all workspace dependencies
RUN npm ci --include-workspace-root

# Copy all source (leaderboard imports types from engine)
COPY engine/ engine/
COPY challenges/ challenges/
COPY leaderboard/ leaderboard/

# Build Next.js (standalone output for smaller image)
RUN npm run build --workspace=leaderboard

# --- Production stage ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output + dependencies
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/leaderboard ./leaderboard
COPY --from=base /app/engine ./engine
COPY --from=base /app/challenges ./challenges

EXPOSE 3000

# ENGINE_URL is read at runtime by next.config.ts rewrites
CMD ["npm", "run", "start", "--workspace=leaderboard"]
