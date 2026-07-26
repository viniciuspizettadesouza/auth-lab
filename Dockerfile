FROM node:24.18.0-alpine3.23 AS development

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run dev -- --hostname 0.0.0.0"]
