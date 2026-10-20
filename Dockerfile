# Build:  docker build -t mandela-catalogue .
# Run:    docker run -p 3000:3000 -v mandela-data:/data \
#           -e AUTH_SECRET="$(openssl rand -base64 48)" \
#           -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=choose-a-long-password \
#           mandela-catalogue
# If you serve it over plain http (no HTTPS in front), also add -e COOKIE_SECURE=false

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/mandela.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
# /login is public and touches the database, so a 200 means the app and SQLite both work.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
