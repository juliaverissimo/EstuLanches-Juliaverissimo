FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /code

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY tests ./tests


USER node

EXPOSE 5000
CMD ["node", "src/server.js"]
