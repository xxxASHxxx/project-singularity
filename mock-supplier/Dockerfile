FROM node:20-alpine AS deps
WORKDIR /app
# Install native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public/ exists so Next.js doesn't warn during build
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Need python/make for better-sqlite3 at runtime too
RUN apk add --no-cache python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json ./
COPY src ./src
EXPOSE 3001
CMD ["npm", "start"]
