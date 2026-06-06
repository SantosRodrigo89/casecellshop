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

## Fora do escopo (intencional)

| Item              | Motivo                                        |
| ----------------- | --------------------------------------------- |
| Kafka / RabbitMQ  | Fluxo síncrono; mensageria sem retorno no escopo |
| Kubernetes        | Docker Compose cobre dev/demo adequadamente   |
| CQRS / Event Sourcing | Complexidade desproporcional ao modelo     |
| Terraform / IaC   | Deploy documentado no README; sem entrega de IaC |
| Microsserviços reais | Monólito modular com fronteiras claras; pronto para extração futura |
| Pagamento real    | Fora do escopo do desafio                     |
