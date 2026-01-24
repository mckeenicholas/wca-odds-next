FROM node:24-slim AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

ENV VITE_API_URL="https://odds.nmckee.org"

RUN npm run build

FROM nginx:1.28.0-alpine-slim

COPY --from=builder /app/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]