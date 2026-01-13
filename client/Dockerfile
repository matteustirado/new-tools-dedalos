FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p public
RUN cp src/assets/image/favicon.png public/favicon.png || true

ENV VITE_API_URL="https://api.dedalosbar.com"
ENV VITE_API_URL_SP="https://dedalosadm2-3dab78314381.herokuapp.com/"
ENV VITE_API_TOKEN_SP="7a9e64071564f6fee8d96cd209ed3a4e86801552"
ENV VITE_SOCKET_TRIGGER_SP="https://placar-80b3f72889ba.herokuapp.com/"
ENV VITE_API_URL_BH="https://dedalosadm2bh-09d55dca461e.herokuapp.com/"
ENV VITE_API_TOKEN_BH="919d97d7df39ecbd0036631caba657221acab99d"
ENV VITE_SOCKET_TRIGGER_BH="https://placarbh-cf51a4a5b78a.herokuapp.com/"

RUN npm run build

RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]