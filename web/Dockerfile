# Сборка Next.js 16 + Prisma 7 (требует Node 22.12+/24+)
FROM node:22-slim

WORKDIR /app

# Prisma на slim-образе нуждается в openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Зависимости (postinstall запустит prisma generate; нужна схема)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# Исходники + сборка
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
