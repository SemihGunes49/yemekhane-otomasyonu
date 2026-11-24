FROM node:22
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.js ./
ENV NODE_ENV=production
USER node
CMD ["node", "server.js"]
