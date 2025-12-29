# ERP ADM Docker

## Visão Geral

Este é um sistema de ERP simplificado para administração de inventário, solicitações de compra e gerenciamento de usuários. A aplicação é totalmente containerizada utilizando Docker e Docker Compose para facilitar a configuração e a implantação do ambiente de desenvolvimento.

---

## Tecnologias Utilizadas

- **Frontend:**
  - React 19 com TypeScript
  - Vite como ambiente de desenvolvimento e build
  - React Router para navegação
  - Tailwind CSS (através de classes utilitárias) para estilização

- **Backend:**
  - Node.js com Express.js
  - PostgreSQL como banco de dados

- **Containerização:**
  - Docker
  - Docker Compose

- **Gerenciamento de Banco de Dados:**
  - Adminer (acessível via navegador)

---

## Estrutura do Projeto

```
/
├── server/             # Contém a API backend (Express.js)
├── components/         # Componentes React reutilizáveis
├── contexts/           # Provedores de contexto React (Autenticação, Estado Global do ERP)
├── pages/              # Componentes de página (Dashboard, Inventário, etc.)
├── .env                # Arquivo para variáveis de ambiente (NÃO deve ser versionado)
├── docker-compose.yml  # Orquestração dos containers Docker
├── Dockerfile          # Definição do container para o frontend
└── README.md           # Esta documentação
```

---

## Configuração do Ambiente

### Pré-requisitos
- Docker e Docker Compose instalados em sua máquina.

### 1. Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto. Você pode copiar o conteúdo abaixo e ajustá-lo se necessário.

```env
# --- FRONTEND ---
# URL base para a API que o frontend irá chamar.
# Use localhost para que o navegador possa acessar a API na sua máquina.
VITE_API_BASE_URL=http://localhost:5000
GEMINI_API_KEY=<OPCIONAL_SUA_CHAVE_GEMINI_API>

# --- BACKEND (API) ---
# Porta em que a API irá rodar.
PORT=5000

# --- BANCO DE DADOS (POSTGRES) ---
# Nome do host do serviço do banco de dados (deve corresponder ao nome no docker-compose.yml).
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=erp_db

# --- CREDENCIAIS PADRÃO ---
# Senha para o primeiro usuário administrador a ser criado.
DEFAULT_ADMIN_PASSWORD=Mudar@123
```

### 2. Iniciando a Aplicação

Com o Docker em execução, rode o seguinte comando na raiz do projeto:

```bash
docker-compose up --build -d
```
- O argumento `--build` força a reconstrução das imagens, o que é importante após alterações no código ou dependências.
- O argumento `-d` (detached mode) executa os containers em segundo plano.

Para parar a aplicação, use:
```bash
docker-compose down
```

---

## Serviços Disponíveis

Após iniciar os containers, os seguintes serviços estarão acessíveis:

- **Aplicação Frontend (ERP):**
  - **URL:** `http://localhost:3000`

- **API Backend:**
  - **URL:** `http://localhost:5000`

- **Adminer (Gerenciador de Banco de Dados):**
  - **URL:** `http://localhost:8080`
  - Use as credenciais do banco de dados definidas no arquivo `.env` para fazer login.
    - **Sistema:** PostgreSQL
    - **Servidor:** `postgres` (nome do serviço Docker)
    - **Usuário:** `admin`
    - **Senha:** `password123`
    - **Banco de dados:** `erp_db`

---

## Credenciais Padrão

Ao iniciar a aplicação pela primeira vez, um usuário administrador padrão é criado:

- **Email:** `admin@grupond.com.br`
- **Senha:** `Mudar@123` (ou o valor de `DEFAULT_ADMIN_PASSWORD` no seu `.env`)