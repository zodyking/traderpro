# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

# Copy TradingView into the Nitro bundle without npm install (avoids platform dep conflicts).
RUN mkdir -p .output/server/node_modules/@mathieuc \
  && cp -r node_modules/@mathieuc/tradingview .output/server/node_modules/@mathieuc/

# --- Production stage ---
FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
  && npm install --save-prod tsx drizzle-kit \
  && npm cache clean --force

COPY --from=build /app/.output ./.output
COPY db ./db
COPY drizzle.config.ts ./
COPY worker ./worker
COPY shared ./shared
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "const p=process.env.PORT||3000; fetch('http://127.0.0.1:'+p+'/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
