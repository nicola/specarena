FROM node:20-slim AS base

WORKDIR /app

# Copy root workspace config
COPY package.json ./

# Copy package.json files for required workspaces (needed for npm install)
COPY engine/package.json engine/
COPY challenges/package.json challenges/
COPY scoring/package.json scoring/
COPY leaderboard/package.json leaderboard/

# Install only the workspaces we need (avoids resolving api/cli
# which aren't copied and would 404 on npm)
RUN npm install --workspace=leaderboard --workspace=engine --workspace=challenges --workspace=scoring --include-workspace-root

# Copy all source (leaderboard imports types from engine)
COPY SKILL.md ./
COPY engine/ engine/
COPY challenges/ challenges/
COPY scoring/ scoring/
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
COPY --from=base /app/scoring ./scoring

EXPOSE 3000

# ENGINE_URL is read at runtime by next.config.ts rewrites
CMD ["npm", "run", "start", "--workspace=leaderboard"]
