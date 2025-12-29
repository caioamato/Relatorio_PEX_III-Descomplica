# Dockerfile (na raiz)
FROM node:20-alpine

WORKDIR /app

# Copia e instala dependências
COPY package.json package-lock.json* ./
RUN npm install

# Copia o código do projeto
COPY . .

# Expõe a porta do Vite
EXPOSE 3000

# Roda o servidor de desenvolvimento
CMD ["npm", "run", "dev", "--", "--host"]