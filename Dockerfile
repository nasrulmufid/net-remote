# ---- builder: install all deps + build Tailwind CSS ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build:css && npm prune --omit=dev

# ---- production ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
