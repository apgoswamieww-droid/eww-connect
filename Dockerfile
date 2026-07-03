FROM node:22-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts || npm ci --ignore-scripts
COPY . .

RUN npx prisma generate

EXPOSE 3000 3333

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run dev & npm run dev:server & wait"]
