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

---

## Fase 4 — Products

**Prompt:** Módulo Products completo: schema Mongoose, seed automática (3-5 produtos, só quando vazio), GET /api/products ordenado por nome, DTOs com Swagger, testes para service e seed.

**Resultado:**
- `products/schemas/product.schema.ts` — schema Mongoose com `timestamps: true`, `versionKey: false` e transform `toJSON` para expor `id` em vez de `_id`
- `products/products.seed.ts` — constante `PRODUCT_SEEDS` com 5 capinhas de exemplo
- `products/products-seed.service.ts` — `OnModuleInit` que chama `countDocuments()` e insere apenas se a coleção estiver vazia; idempotente
- `products/products.service.ts` — `findAll()` com `find().sort({ name: 1 }).exec()`
- `products/products.controller.ts` — `GET /api/products` com `@ApiTags`, `@ApiOperation`, `@ApiOkResponse`
- `products/dto/product-response.dto.ts` — `@ApiProperty` em todos os campos
- `products/products.service.spec.ts` — testa `findAll()` (retorno correto + encadeamento sort)
- `products/products-seed.service.spec.ts` — testa seed quando vazia (insere), quando populada (pula), e formato dos seeds

**Decisões:**
- Seed separada do `ProductsService`: mantém separação de responsabilidades e permite testar os dois de forma independente (o `OnModuleInit` não interfere nos unit tests do service)
- `Record<string, unknown>` no transform do toJSON: evita `any` e satisfaz o ESLint (`no-unsafe-member-access`)
- `createdAt` / `updatedAt` declarados na classe `Product` para TypeScript reconhecê-los no tipo de retorno

**Validação:**
- `tsc --noEmit`: limpo
- `npm run lint`: limpo
- `npm test`: 9/9 verdes (3 suites: health, products service, products seed)
- `GET /api/products` ao vivo: 5 produtos do seed, ordenados por nome, com `id` em vez de `_id`
- `GET /api/docs`: Swagger atualizado com a tag `products` e schema `ProductResponseDto`

---

## Fase 5 — Orders Core

**Prompt:** Módulo Orders completo (sem estoque, sem idempotência, sem ERP): schema Order com enum OrderStatus, CreateOrderDto com class-validator, OrderResponseDto com Swagger, POST /api/orders (valida produto + calcula total), GET /api/orders/:id. Testes para criação, produto inexistente e quantidade inválida.

**Resultado:**
- `orders/schemas/order.schema.ts` — schema Mongoose com enum `OrderStatus` (PENDING/PROCESSING/COMPLETED/FAILED), `idempotencyKey` (unique), `productId` como ref ObjectId, transform toJSON para `id`
- `orders/dto/create-order.dto.ts` — `@IsMongoId`, `@IsInt`, `@Min(1)` com mensagens em PT
- `orders/dto/order-response.dto.ts` — `@ApiProperty` completo incluindo enum de status
- `orders/orders.service.ts` — `create()`: valida produto via `ProductsService.findById`, calcula total, cria com status PENDING e UUID como idempotencyKey placeholder; `findOne()`: valida ObjectId + 404 se não encontrado
- `orders/orders.controller.ts` — `POST /api/orders` (201/400/404) e `GET /api/orders/:id` (200/404) com Swagger completo
- `orders/orders.module.ts` — importa `MongooseModule.forFeature` + `ProductsModule`
- `orders/orders.service.spec.ts` — 10 testes: validação do DTO (4), create (2), findOne (3), definição
- `products/products.service.ts` — adicionado `findById(id)` com `isValidObjectId` guard
- `products/products.service.spec.ts` — adicionados 2 testes para `findById`

**Decisões:**
- `ProductsService.findById` em vez de injetar o model de Product no OrdersModule: mantém cada serviço responsável pelo seu próprio modelo
- `isValidObjectId` guard antes de qualquer query: evita CastError do Mongoose para IDs malformados, convertendo em 404 limpo
- `randomUUID()` nativo do Node.js 20 (sem dependência extra): placeholder para idempotencyKey até a Fase 6
- Total com `toFixed(2)` + `parseFloat`: evita imprecisão de ponto flutuante

**Validação ao vivo:**
- `POST /api/orders` → 201 PENDING, total calculado (2 × R$44,90 = R$89,80)
- `GET /api/orders/:id` → retorna o pedido criado
- `POST` quantity=0 → 400 com mensagem em PT
- `POST` produto inexistente → 404
- `GET` id inválido → 404
- Swagger `/api/docs` → 200 com tags orders e products

**Pendências para Fase 6:**
- Redução atômica de estoque (`findOneAndUpdate` com `$gte`)
- Idempotência real (header `Idempotency-Key` + índice único + deduplicação)
- `FakeErpService` (timeout + falha) + compensação de estoque + status FAILED/503
