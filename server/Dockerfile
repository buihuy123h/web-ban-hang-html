# syntax=docker/dockerfile:1

# Build context bắt buộc là thư mục server/.
# Stage này chỉ cài dependency đã khóa trong package-lock.json.
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
# Container production chỉ hỗ trợ DB_AUTH_MODE=sql qua mssql/tedious. Bỏ install script
# của adapter ODBC Windows để image Linux không cần compiler/ODBC native không sử dụng.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Cho phép CI/QA kiểm thử đúng môi trường Linux mà không cần SQL Server thật:
#   docker build --target test -t do-cu-quang-huy-api:test .
FROM dependencies AS test

ENV NODE_ENV=test

COPY . .
RUN npm test

# Image runtime không kế thừa source/test từ stage test và không chứa frontend.
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node app.js config.js index.js ./
COPY --chown=node:node controllers ./controllers
COPY --chown=node:node data ./data
COPY --chown=node:node lib ./lib
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node models ./models
COPY --chown=node:node routes ./routes
COPY --chown=node:node scripts/precompress.js ./scripts/precompress.js
COPY --chown=node:node public/images ./public/images

USER node

# Render cấp PORT lúc chạy; 3000 chỉ là cổng mặc định khi chạy local.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
