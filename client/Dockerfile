# Etapa 1: Build
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# --- AQUI ESTÁ A MUDANÇA ---
# Estamos forçando explicitamente o endereço LOCALHOST.
# Isso garante que o site saiba que o backend está no seu computador.
RUN echo "VITE_API_URL=http://localhost:4000" > .env.production && \
    echo "VITE_API_URL_SP=https://dedalosadm2-3dab78314381.herokuapp.com/" >> .env.production && \
    echo "VITE_API_TOKEN_SP=7a9e64071564f6fee8d96cd209ed3a4e86801552" >> .env.production && \
    echo "VITE_SOCKET_TRIGGER_SP=https://placar-80b3f72889ba.herokuapp.com/" >> .env.production && \
    echo "VITE_API_URL_BH=https://dedalosadm2bh-09d55dca461e.herokuapp.com/" >> .env.production && \
    echo "VITE_API_TOKEN_BH=919d97d7df39ecbd0036631caba657221acab99d" >> .env.production && \
    echo "VITE_SOCKET_TRIGGER_BH=https://placarbh-cf51a4a5b78a.herokuapp.com/" >> .env.production

RUN npm run build

# Etapa 2: Servir
FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]