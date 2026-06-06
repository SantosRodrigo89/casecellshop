# Arquitetura

## Objetivo

Mini-fluxo de checkout para uma loja de capinhas: vitrine de produtos, criação de pedidos com controle de estoque e idempotência, integração com ERP simulado.

## Tecnologias

| Camada    | Tecnologia                         |
| --------- | ---------------------------------- |
| Backend   | NestJS 11 (TypeScript)             |
| Frontend  | Next.js 16 (TypeScript + Tailwind) |
| Banco     | MongoDB 7 (Mongoose)               |
| Cache/KV  | Redis 7 (ioredis)                  |
| Logger    | pino / nestjs-pino                 |
| Docs      | Swagger / OpenAPI (@nestjs/swagger) |
| Infra dev | Docker Compose                     |

## Módulos

```
AppModule
├── SharedModule (@Global) — ConfigModule, MongooseModule, LoggerModule, Redis provider
├── HealthModule             — GET /api/health (terminus: MongoDB + Redis)
├── ProductsModule           — GET /api/products + seed automática
├── OrdersModule             — POST /api/orders, GET /api/orders/:id  [Fase 5]
└── ErpModule                — FakeErpService                         [Fase 6]
```

## Estratégias

### Vitrine (Products)

- `GET /api/products` retorna todos os produtos ordenados por nome.
- Seed automática no boot (via `OnModuleInit`): insere 5 produtos apenas se a coleção estiver vazia. Idempotente em reinicializações.

### Estoque

- Operação atômica condicional: `findOneAndUpdate({_id, stock:{$gte:qty}}, {$inc:{stock:-qty}})`.
- Retorno `null` → HTTP 409 (sem overselling).

### Idempotência

- Header `Idempotency-Key` obrigatório no `POST /api/orders`.
- Índice único em `orders.idempotencyKey` no MongoDB.
- Colisão (`E11000`) → retorna o pedido existente.

### ERP

- `FakeErpService` simula latência e falha configurável via env.
- Timeout real + compensação de estoque em falha → status `FAILED` + HTTP 503.

### Status do pedido

`PENDING → PROCESSING → COMPLETED | FAILED`

### Healthcheck

`GET /api/health` via `@nestjs/terminus`, agrega:
- Ping MongoDB (`MongooseHealthIndicator`)
- Ping Redis (`RedisHealthIndicator` customizado — terminus não tem nativo)

## Container Architecture

```
docker compose up --build
├── mongo     (mongo:7, port 27017, volume mongo-data)
├── redis     (redis:7-alpine, port 6379, volume redis-data)
├── backend   (node:22-alpine, port 3001, depends_on mongo+redis healthy)
│   └── dist/main — compiled NestJS app
└── frontend  (node:22-alpine, port 3000, depends_on backend)
    └── .next/standalone/server.js — Next.js standalone server
```

`NEXT_PUBLIC_API_URL` is passed as a Docker build ARG and baked into the
client bundle at image build time. Default: `http://localhost:3001/api`
(the backend port mapped to the host, reachable by the browser).

## Fora do escopo (intencional)

| Item              | Motivo                                        |
| ----------------- | --------------------------------------------- |
| Kafka / RabbitMQ  | Fluxo síncrono; mensageria sem retorno no escopo |
| Kubernetes        | Docker Compose cobre dev/demo adequadamente   |
| CQRS / Event Sourcing | Complexidade desproporcional ao modelo     |
| Terraform / IaC   | Deploy documentado no README; sem entrega de IaC |
| Microsserviços reais | Monólito modular com fronteiras claras; pronto para extração futura |
| Pagamento real    | Fora do escopo do desafio                     |
