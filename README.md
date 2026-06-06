# CaseCellShop

Desafio técnico Fullstack Pleno — mini-fluxo de checkout para uma loja de capinhas.

## Stack

- NestJS (TypeScript)
- Next.js (TypeScript)
- MongoDB (Mongoose)
- Redis (ioredis)
- Docker Compose

## Estrutura do monorepo

```
casecellshop/
├── apps/
│   ├── backend/     # API NestJS
│   └── frontend/    # App Next.js
├── docs/            # ARCHITECTURE, SPECIFICATION, ADRs
├── docker-compose.yml
└── package.json     # scripts de orquestração
```

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose

## Como executar

### 1. Subir a infraestrutura (MongoDB + Redis)

```bash
docker compose up -d
```

Os dados são persistidos em volumes Docker (`mongo-data`, `redis-data`).
Portas (configuráveis por env): MongoDB `27017`, Redis `6379`.

### 2. Configurar variáveis de ambiente

```bash
cp .env.example apps/backend/.env
```

| Variável           | Padrão                                       | Descrição                              |
| ------------------ | -------------------------------------------- | -------------------------------------- |
| `PORT`             | `3001`                                       | Porta da API                           |
| `MONGO_URI`        | `mongodb://localhost:27017/casecellshop`     | Conexão MongoDB                        |
| `REDIS_HOST`       | `localhost`                                  | Host do Redis                          |
| `REDIS_PORT`       | `6379`                                       | Porta do Redis                         |
| `ERP_FAILURE_MODE` | `never`                                      | Simulação do ERP: `never`/`always`/`rate` |
| `ERP_LATENCY_MS`   | `500`                                        | Latência artificial do ERP             |
| `ERP_TIMEOUT_MS`   | `3000`                                       | Timeout da chamada ao ERP              |

As variáveis são validadas no boot (`@nestjs/config` + `class-validator`); a aplicação falha rápido se algo estiver ausente ou inválido.

### 3. Instalar dependências e rodar

```bash
# backend
npm run dev:backend     # http://localhost:3001/api

# frontend
npm run dev:frontend    # http://localhost:3000
```

## Endpoints

- `GET /api/health` — healthcheck agregando MongoDB e Redis (via `@nestjs/terminus`).
- `GET /api/docs` — documentação Swagger/OpenAPI interativa.
- `GET /api/products` — vitrine (Fase 4).
- `POST /api/orders` + `GET /api/orders/:id` — checkout (Fase 5).

### Exemplo de healthcheck

```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## Scripts

| Script                    | Ação                                  |
| ------------------------- | ------------------------------------- |
| `npm run dev:backend`     | API NestJS em watch mode              |
| `npm run dev:frontend`    | App Next.js em dev                    |
| `npm test`                | Testes unitários do backend           |
| `npm run test:e2e`        | Testes e2e do backend (requer infra)  |
| `npm run lint`            | Lint de backend e frontend            |
| `npm run build`           | Build de produção dos dois apps       |

## Testes

- Unitários: `npm test`
- E2E (requer `docker compose up`): `npm run test:e2e`

## Arquitetura e decisões

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e os ADRs em [docs/](docs/).

### Trade-offs (resumo)

- **Monólito modular** em vez de microsserviços reais: coesão e fronteiras claras sem custo de rede/observabilidade distribuída. Ver [ADR-001](docs/ADR-001-monolito-modular.md).
- **Sem Kafka/RabbitMQ**: o fluxo de checkout é síncrono e simples.
- **Sem Kubernetes**: Docker Compose cobre o escopo de dev/demo.
- **Sem CQRS/Event Sourcing/Terraform**: complexidade sem retorno para o escopo.

### Evoluções futuras

Mensageria (Kafka/RabbitMQ) para processamento assíncrono, Kubernetes para orquestração em produção, e deploy em cloud pública (AWS/Azure/GCP) — detalhados na Fase 12.
