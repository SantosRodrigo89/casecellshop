# Arquitetura

## Objetivo

Implementar um fluxo simples de checkout para uma loja de capinhas.

## Tecnologias

Backend:
- NestJS
- MongoDB
- Redis

Frontend:
- Next.js

Infra:
- Docker Compose

## Estratégias

### Estoque

Utilizar operação atômica para impedir venda acima do estoque.

### Idempotência

Utilizar Idempotency-Key para impedir pedidos duplicados.

### ERP

Utilizar FakeErpService para simular lentidão e falhas.

### Status do pedido

- PENDING
- PROCESSING
- COMPLETED
- FAILED

## Fora do escopo

- Pagamento real
- Kubernetes
- Kafka
- Microsserviços reais