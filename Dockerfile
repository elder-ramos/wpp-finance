# Usar a versão Alpine do Node.js
FROM node:20-alpine

# Instalar dependências do Chromium para Alpine e Python
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libx11 \
    libxcomposite \
    libxdamage \
    libxext \
    libxfixes \
    libxrandr \
    libxrender \
    libxscrnsaver \
    libxtst \
    python3 \
    py3-pip && \
    python3 -m venv /opt/venv && \
    . /opt/venv/bin/activate

# Configurar variáveis de ambiente do Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Configurar diretório de trabalho
WORKDIR /app

# Copiar e instalar dependências
COPY package*.json ./
RUN npm install

# Copiar código fonte
COPY . .

# Expor porta e executar
EXPOSE 3000
CMD ["npm", "start"]