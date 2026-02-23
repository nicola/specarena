FROM node:20-slim AS base

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for all workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY leaderboard/package.json leaderboard/

# Install dependencies (no lockfile — npm resolves platform-specific native
# binaries like lightningcss/swc for the container OS)
RUN npm install --include-workspace-root

# Copy all source (leaderboard imports types from engine)
COPY SKILL.md ./
COPY engine/ engine/
COPY challenges/ challenges/
COPY leaderboard/ leaderboard/

# Build Next.js — set ENGINE_URL for rewrites (baked into routes-manifest.json)
ARG ENGINE_URL=http://engine:3001
ENV ENGINE_URL=${ENGINE_URL}
RUN npm run build --workspace=leaderboard

# --- Production stage ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output + node_modules + source (needed for next start with rewrites)
COPY --from=base /app/package.json ./
COPY --from=base /app/SKILL.md ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/leaderboard ./leaderboard
COPY --from=base /app/engine ./engine
COPY --from=base /app/challenges ./challenges

EXPOSE 3000

# ENGINE_URL is read at runtime by next.config.ts rewrites
CMD ["npm", "run", "start", "--workspace=leaderboard"]
