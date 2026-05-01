FROM oven/bun:1.3.13-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

CMD ["bun", "run", "start"]
