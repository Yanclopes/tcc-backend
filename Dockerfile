# =========================================================================
# Estagio 1 - build: instala TODAS as dependencias e compila o TypeScript.
# =========================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Copia manifestos primeiro para aproveitar o cache de camadas do Docker.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove dependencias de desenvolvimento apos o build para reduzir a imagem.
RUN npm prune --omit=dev

# =========================================================================
# Estagio 2 - runtime: imagem enxuta apenas com o necessario para rodar.
# =========================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Usuario sem privilegios (boa pratica de seguranca em containers).
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

# Healthcheck usa o endpoint /health exposto pelo modulo Terminus.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
