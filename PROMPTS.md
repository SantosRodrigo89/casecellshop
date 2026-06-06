# Prompts Utilizados

Este arquivo registra os prompts relevantes utilizados durante o desenvolvimento do desafio.

---

## Arquitetura (Plano)

**Prompt:** Análise completa de requisitos, riscos, proposta de arquitetura, entidades, estratégias de idempotência/estoque/testes e fases de implementação.

**Resultado:** Plano arquitetural em `.cursor/plans/casecellshop_checkout_e29559cb.plan.md` com:
- Monólito modular NestJS (sem Clean Architecture em camadas)
- Order de item único
- Idempotência por `Idempotency-Key` + índice único no MongoDB
- Decremento atômico de estoque via `findOneAndUpdate`
- ERP fake com falha determinística via `overrideProvider`
- Redis no `/health` + cache da vitrine como bônus
- 12 fases de implementação

---

## Fase 1 — Bootstrap

**Prompt:** Bootstrap do projeto: criar NestJS + Next.js, configurar ESLint/Prettier/Jest, estrutura de pastas conforme plano, scripts de desenvolvimento. Sem regras de negócio.

**Resultado:**
- Monorepo com `package.json` raiz e scripts via `--prefix`
- Backend NestJS 11 scaffoldado em `apps/backend/` com TypeScript
- Frontend Next.js 16 scaffoldado em `apps/frontend/` com TypeScript + Tailwind + App Router
- Boilerplate padrão removido (`AppController`, `AppService`)
- Módulos esqueléticos criados: `health`, `products`, `orders`, `erp`, `shared`
- `common/` com `HttpExceptionFilter` e decorator `@IdempotencyKey`
- `config/env.config.ts` com tipagem de todas as variáveis de ambiente
- `src/lib/api/index.ts` no frontend com cliente HTTP tipado
- `.env.example`, `.prettierrc`, `.editorconfig` na raiz
- ADR-001 documentando decisão de monólito modular

**Decisões:**
- `--prefix` em vez de `npm workspaces` para evitar reinstalação completa com disco limitado
- Porta 3001 para o backend (evita conflito com o frontend em 3000)
- `globalPrefix('api')` desde o início para URL limpa
- Módulos esqueléticos compiláveis: demonstram arquitetura sem implementar negócio

---

## Fase 2 — Infra (Docker Compose)

**Prompt:** docker-compose funcional com MongoDB, Redis, volumes persistentes, variáveis de ambiente; validar subida.

**Resultado:**
- `docker-compose.yml` com serviços `mongo` (mongo:7) e `redis` (redis:7-alpine)
- Volumes persistentes `mongo-data` e `redis-data`
- Healthchecks nativos em ambos os serviços
- Portas parametrizáveis via env (`MONGO_PORT`, `REDIS_PORT`)
- Removida a chave `version` (obsoleta no Compose v2)

---

## Fase 3 — Skeleton de infraestrutura do NestJS

**Prompt:** instalar/configurar `@nestjs/config`, `mongoose`, `ioredis`; SharedModule com providers; `GET /health` real com Mongo+Redis; Swagger em `/api/docs`; ValidationPipe global; HttpExceptionFilter global; logger.

**Resultado:**
- `config/env.validation.ts` — validação de env no boot (fail-fast) com `class-validator`
- `shared/shared.module.ts` (@Global) — `ConfigModule`, `MongooseModule.forRootAsync`, `LoggerModule` (pino) e provider Redis
- `shared/redis.provider.ts` + `redis.constants.ts` — conexão ioredis injetável via token `REDIS_CLIENT`
- `health/redis.health.ts` — indicador de saúde customizado do Redis (terminus não traz nativo)
- `health/health.controller.ts` — `@nestjs/terminus` agregando `mongodb` + `redis`
- `main.ts` — `ValidationPipe` global (whitelist/transform), `HttpExceptionFilter` global, Swagger em `/api/docs`, logger pino, shutdown hooks

**Decisões:**
- `SharedModule` como hub global de infraestrutura: evita reimportar Config/Mongo/Redis em cada módulo
- Indicador Redis manual (PING) porque o Terminus não possui indicador nativo de Redis
- Logger pino em JSON (sem `pino-pretty`) para reduzir dependências e ser production-friendly
- Env validada no boot: a aplicação falha rápido se uma variável obrigatória faltar
- Mantida a estrutura tradicional do NestJS; nenhuma regra de negócio (Products/Orders) implementada
