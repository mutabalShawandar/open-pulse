FROM node:24-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js inlines NEXT_PUBLIC_* variables while building.  The remaining
# authentication settings are supplied at runtime by Docker Compose.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG APP_URL
ARG KEYCLOAK_ISSUER
ARG KEYCLOAK_FRONTEND_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ROOT_DOMAIN=${NEXT_PUBLIC_ROOT_DOMAIN}
ENV APP_URL=${APP_URL}
ENV KEYCLOAK_ISSUER=${KEYCLOAK_ISSUER}
ENV KEYCLOAK_FRONTEND_CLIENT_ID=${KEYCLOAK_FRONTEND_CLIENT_ID}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
