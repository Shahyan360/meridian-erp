FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY . .
ARG DATABASE_MODE=demo
ENV DATABASE_MODE=${DATABASE_MODE}
RUN npm run db:generate && npm run build && mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production DEMO_MODE=false DEMO_DATABASE_URL=file:/data/meridian.db PORT=4000
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/vps-start.mjs"]
