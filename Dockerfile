# syntax=docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

# Note: DB defaults to ./data.db inside the container. Mount a volume for persistence.
CMD ["node", "src/server.js"]
