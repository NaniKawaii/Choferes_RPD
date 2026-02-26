FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh","-c","node -e \"require('./db').ensureSchema().then(()=>console.log('migrations ok')).catch(e=>{console.error(e);process.exit(1)})\" && node index.js"]
