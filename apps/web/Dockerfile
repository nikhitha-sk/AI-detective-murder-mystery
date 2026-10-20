# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci -w @mystery/web -w @mystery/shared --include-workspace-root=false

COPY packages/shared packages/shared
COPY apps/web apps/web

# Baked into the client bundle at build time.
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:4300
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
RUN npm run build -w @mystery/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3300 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3300
CMD ["node", "apps/web/server.js"]
