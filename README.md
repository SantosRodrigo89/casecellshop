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

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/health` | Health check: MongoDB + Redis via `@nestjs/terminus` |
| `GET` | `/api/docs` | Swagger UI — interactive API documentation |
| `GET` | `/api/products` | Product catalogue, sorted by name |
| `POST` | `/api/orders` | Create order — requires `Idempotency-Key` header; validates product, atomically decrements stock (409 if insufficient), deduplicates retries, returns `PENDING` order |
| `GET` | `/api/orders/:id` | Get order by ID |

### Stock control

`POST /api/orders` uses a single atomic MongoDB operation to prevent overselling:

```
findOneAndUpdate(
  { _id: productId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } }
)
```

If the operation returns `null` (stock is less than the requested quantity), the endpoint responds with **HTTP 409 Conflict** and no order is created.

### Order lifecycle

`PENDING → PROCESSING → COMPLETED | FAILED`

`POST /api/orders` always returns HTTP **201** with the final order. Check the `status` field:

| `status` | Meaning |
|---|---|
| `COMPLETED` | ERP accepted the order; stock is decremented. |
| `FAILED` | ERP failed; stock was atomically restored (compensation). `failureReason` field explains why. |

### Idempotency

`POST /api/orders` requires an `Idempotency-Key` header (UUID recommended):

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

- Missing header → **HTTP 400 Bad Request**.
- First request → order created and processed (201 COMPLETED or 201 FAILED).
- Repeat with same key → existing order returned immediately, stock not touched.

Deduplication uses a pre-check (`findOne`) + MongoDB unique index on `idempotencyKey`. Concurrent inserts with the same key trigger `E11000`; the service restores the stock it decremented and returns the winning order.

### ERP simulation

The ERP is simulated via `FakeErpService`, controlled entirely by env vars:

| Variable | Values | Effect |
|---|---|---|
| `ERP_FAILURE_MODE` | `never` / `always` / `rate` | Controls failure probability |
| `ERP_LATENCY_MS` | integer ms | Artificial latency per call |
| `ERP_TIMEOUT_MS` | integer ms | Timeout threshold; if latency ≥ timeout the call times out |

In E2E tests the service is replaced via `overrideProvider()` — zero flakiness, no real timers.

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

## Frontend

Open `http://localhost:3000` after running `npm run dev:frontend`.

- Product grid loads from `GET /api/products`.
- Each card shows name, price, and current stock.
- Select quantity and click **Buy Now** to place an order.
- A fresh `Idempotency-Key` (UUID) is generated per purchase attempt.
- The button is disabled during processing to prevent duplicate clicks.
- After purchase: order ID, status (`COMPLETED` / `FAILED`), and total are displayed.
- Error messages: 400 (invalid request), 404 (product not found), 409 (out of stock), 5xx (temporary failure).

## Tests

- Unit tests: `npm test` — 33 tests, 4 suites (health, products, seed, orders)
- E2E (requires `docker compose up`): `npm run test:e2e` — 7 tests, 2 suites

Key E2E scenarios (all passing):
1. Successful purchase → 201 COMPLETED, stock decremented
2. Invalid quantity → 400
3. Product not found → 404
4. Insufficient stock → 409
5. Duplicate `Idempotency-Key` → same order returned, no duplicate
6. ERP failure → 201 FAILED, stock fully restored

## Arquitetura e decisões

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e os ADRs em [docs/](docs/).

### Trade-offs (resumo)

- **Monólito modular** em vez de microsserviços reais: coesão e fronteiras claras sem custo de rede/observabilidade distribuída. Ver [ADR-001](docs/ADR-001-monolito-modular.md).
- **Sem Kafka/RabbitMQ**: o fluxo de checkout é síncrono e simples.
- **Sem Kubernetes**: Docker Compose cobre o escopo de dev/demo.
- **Sem CQRS/Event Sourcing/Terraform**: complexidade sem retorno para o escopo.

### Evoluções futuras

Mensageria (Kafka/RabbitMQ) para processamento assíncrono, Kubernetes para orquestração em produção, e deploy em cloud pública (AWS/Azure/GCP) — detalhados na Fase 12.
