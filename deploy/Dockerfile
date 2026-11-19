# Образ кабинета: API (Node) раздаёт и /api, и собранную SPA. Собирается из корня репозитория:
#   docker compose --env-file .env -f deploy/compose.yml up -d --build

# --- Сборка: зависимости, contract/api/web ---
FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@10.34.9
# Сначала только манифесты: слой с зависимостями пересобирается, лишь когда они меняются.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Прод-зависимости API отдельным каталогом. В бандле dist/index.js внешние только PGlite, argon2 и postgres,
# остальное уже внутри, но deploy проще и надёжнее, чем перечислять пакеты руками.
RUN pnpm --filter @aihs/api deploy --prod --legacy /out/api

# --- Запуск ---
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    STATIC_DIR=/app/web
WORKDIR /app/api
COPY --from=build /out/api/node_modules ./node_modules
COPY --from=build /out/api/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/web/dist /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# На старте API сам применяет миграции, а пустую БД заполняет сидом (apps/api/src/index.ts).
CMD ["node", "dist/index.js"]
