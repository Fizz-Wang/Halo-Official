FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm install --registry="${NPM_REGISTRY}" --no-audit --no-fund

COPY . .
RUN npm run build

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=256 \
    SITE_RELEASE_MODE=preview \
    SITE_RELEASE_APPROVED=false

WORKDIR /app

COPY --from=build --chown=node:node /app/dist/standalone ./
COPY --from=build --chown=node:node /app/node_modules/react ./node_modules/react
COPY --from=build --chown=node:node /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=build --chown=node:node /app/node_modules/react-server-dom-webpack ./node_modules/react-server-dom-webpack
COPY --from=build --chown=node:node /app/node_modules/scheduler ./node_modules/scheduler

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
