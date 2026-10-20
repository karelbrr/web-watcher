FROM node:22
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["node", "services/api/dist/main.js"]