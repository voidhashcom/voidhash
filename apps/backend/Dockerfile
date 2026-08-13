FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /repo
COPY . .
RUN corepack pnpm@11.21.0 install --frozen-lockfile --filter @voidhash/backend-app... --filter @voidhash/www... --ignore-scripts --config.node-linker=isolated
RUN VITE_APP_API_URL= VITE_APP_ENV=production VOIDHASH_NODE_BUNDLE=true corepack pnpm@11.21.0 exec turbo build --filter @voidhash/www
RUN rm -rf /out && corepack pnpm@11.21.0 --config.ignore-scripts=true --config.node-linker=isolated --filter @voidhash/backend-app deploy --prod --legacy /out
RUN node scripts/check-node-runtime-boundary.mjs /out
RUN rm -rf /www && corepack pnpm@11.21.0 --config.ignore-scripts=true --config.node-linker=hoisted --config.allow-unused-patches=true --filter @voidhash/www deploy --prod --legacy /www
RUN node scripts/check-node-runtime-boundary.mjs /www

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-headless-shell
ENV CHROMIUM_DISABLE_SANDBOX=true
ENV WWW_SERVER_ENTRY=/www/dist/server/server.js
ENV WWW_CLIENT_DIRECTORY=/www/dist/client
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium-headless-shell \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
COPY --from=build --chown=node:node /www/ /www/
COPY --from=build --chown=node:node /repo/apps/www/dist/ /www/dist/

USER node
EXPOSE 5001
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:5001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["./node_modules/.bin/tsx", "src/main.ts"]
