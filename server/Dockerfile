FROM node:18-alpine

# Instala dependências de sistema (ffmpeg e yt-dlp para a Rádio)
RUN apk add --no-cache ffmpeg yt-dlp

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala dependências do Node
RUN npm install

# Copia o código fonte
COPY . .

# Expõe a porta do servidor
EXPOSE 4000

# Comando para iniciar
CMD ["npm", "start"]