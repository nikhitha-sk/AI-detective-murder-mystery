# Build from the repo root:  docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @mystery/server -w @mystery/shared --include-workspace-root=false

COPY packages/shared packages/shared
COPY apps/server apps/server

WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 4300
CMD ["npx", "tsx", "src/index.ts"]
