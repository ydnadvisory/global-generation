FROM node:22.14.0-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace @find-the-evidence/web --include-workspace-root

COPY apps/web ./apps/web
RUN npm run web:build

FROM nginx:1.28.0-alpine

COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

RUN mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp \
    /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp \
    && chown -R nginx:nginx /tmp/nginx /usr/share/nginx/html

USER nginx
EXPOSE 8080

ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
