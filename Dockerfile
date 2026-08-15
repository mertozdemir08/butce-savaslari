# syntax=docker/dockerfile:1

# Bütçe Savaşları — çok aşamalı derleme.
# Çalışma imajı Next derlemesini ve yalnızca üretim bağımlılıklarını taşır.
# Giriş noktası kendi HTTP + WebSocket sunucumuz (server.ts), Next'in kendi
# sunucusu değil; bu yüzden `output: 'standalone'` kullanılmıyor (standalone
# izleyicisi custom server'ın `ws` bağımlılığını kapsamıyor).

# --- 1. aşama: derleme için tüm bağımlılıklar (devDependencies dahil)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- 2. aşama: Next derlemesi
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- 3. aşama: yalnızca üretim bağımlılıkları (next, react, ws, tsx)
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- 4. aşama: çalışma imajı
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json next.config.ts server.ts ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node app ./app
COPY --chown=node:node components ./components
COPY --chown=node:node data ./data
COPY --chown=node:node public ./public
COPY --from=build --chown=node:node /app/.next ./.next

USER node
EXPOSE 3000

# npm start = tsx server.ts. Kaynak TypeScript çalışma anında tsx ile okunur;
# tsconfig.json'daki "@/*" yol takma adları bu yüzden imajda bulunmalı.
CMD ["npm", "start"]
