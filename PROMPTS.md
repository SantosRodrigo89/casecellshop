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

---

## Fase 6 — Atomic Stock Control

**Prompt:** Implement Phase 6 — Atomic Stock Control only. No idempotency, no ERP integration, no Redis, no frontend. Requirements: stock validation before order creation, atomic MongoDB `findOneAndUpdate` with `$gte` + `$inc` to prevent overselling, HTTP 409 ConflictException with clear English message when stock is insufficient, Swagger documentation for 409 and 404 responses, unit tests for success/409/404 and a concurrency simulation test (10 requests, stock=5, exactly 5 succeed).

**Resultado:**
- `products/products.service.ts` — adicionado `decrementStock(id, quantity)`: `findOneAndUpdate({ _id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })`. Retorna o documento anterior ao update (com preço correto) em caso de sucesso, `null` se estoque insuficiente.
- `orders/orders.service.ts` — `create()` atualizado: (1) `findById` → 404; (2) `decrementStock` → 409 `ConflictException`; (3) cria o pedido; (4) retorna com status `PENDING`.
- `orders/orders.controller.ts` — adicionado `@ApiConflictResponse` ao Swagger.
- `orders/dto/order-response.dto.ts` — descrições atualizadas para inglês.
- `products/products.service.spec.ts` — 3 novos testes para `decrementStock` (ObjectId inválido, estoque suficiente, estoque insuficiente).
- `orders/orders.service.spec.ts` — testes atualizados: (1) sucesso com decremento atômico verificado; (2) 404 produto não encontrado (`decrementStock` não chamado); (3) 409 estoque insuficiente (`create` não chamado); (4) simulação de concorrência — 10 requisições simultâneas, stock=5, exatamente 5 bem-sucedidas, stock final = 0.

**Decisões:**
- `decrementStock` em `ProductsService` (não em `OrdersService`): mantém o modelo de produto encapsulado no módulo correto.
- `findById` antes de `decrementStock`: distingue 404 (produto inexistente) de 409 (estoque insuficiente) com mensagens claras — sem race condition relevante porque produtos não são deletados.
- Mocks síncronos via `Promise.resolve` no teste de concorrência: JavaScript é single-threaded; o teste demonstra a lógica correta (5 reservas, 5 rejeições) sem necessidade de banco real.
- Banco real com `mongodb-memory-server` planejado para Fase 7b (testes de integração E2E).

**Validação:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: 27/27 verdes (5 novos testes adicionados)
- `tsc --noEmit`: limpo

---

## Fase 7 — Idempotency

**Prompt:** Implement Phase 7 — Idempotency only. Enforce the `Idempotency-Key` header on `POST /api/orders` (400 if missing), replace the `randomUUID()` placeholder with the actual header value, catch `E11000` (MongoDB duplicate key, code 11000) on `orderModel.create` and return the existing order. Add `@ApiHeader` to Swagger. Add unit tests for the E11000 deduplication and non-E11000 error propagation scenarios.

**Resultado:**
- `orders/orders.controller.ts` — `@ApiHeader` adicionado; `@IdempotencyKey()` wired como parâmetro de `create()`; `BadRequestException` lançada se header ausente; key passada para o service.
- `orders/orders.service.ts` — `randomUUID()` e import `crypto` removidos; assinatura de `create()` atualizada para `(dto, idempotencyKey: string)`; `orderModel.create()` envolto em try/catch: `code === 11000` → `findOne({ idempotencyKey })` → retorna pedido existente; erros não-E11000 re-lançados.
- `orders/orders.service.spec.ts` — `findOne` adicionado ao `mockOrderModel`; todos os `service.create(dto)` atualizados para `service.create(dto, key)`; 2 novos testes: E11000 deduplication e non-E11000 propagation; teste de concorrência atualizado com chaves únicas por request.
- Swagger: descrições de `@ApiOperation`, `@ApiCreatedResponse` e `@ApiBadRequestResponse` atualizadas para documentar o comportamento do header e da deduplicação.

**Decisões:**
- Header validado no controller (concern HTTP), não no service (concern de negócio).
- `(error as { code?: number }).code === 11000` em vez de importar `MongoServerError` de `mongodb` (dependência transitiva do mongoose): evita acoplamento com a versão interna do driver.
- Stock já decrementado antes do `create()`: em caso de E11000, o pedido existente já tem o estoque reservado; não há necessidade de compensação.
- `findOne({ idempotencyKey })` em vez de `findById`: o erro E11000 ocorre antes do Mongoose retornar o `_id`; buscar pela key é a única opção confiável.

**Validação:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: 29/29 verdes (2 novos testes adicionados)
- `tsc --noEmit`: limpo
- `nest build`: limpo

---

## Fase 7b — ERP Resilience + Order Status + E2E

**Prompt:** Implement Phase 7b: full ERP simulation, order status lifecycle (PENDING → PROCESSING → COMPLETED | FAILED), atomic stock compensation on ERP failure, and the 6 mandatory business-scenario E2E tests. No frontend, no Redis locks, no Kafka, no MongoDB transactions, no CQRS.

**Resultado:**
- `erp/fake-erp.service.ts` — `FakeErpService` completo: `ConfigService` injection, latência artificial via `setTimeout`, timeout via corrida entre dois timers, modos `never`/`always`/`rate`. Método `processOrder` assíncrono; sem dependências externas.
- `products/products.service.ts` — `incrementStock(id, quantity)` adicionado: `updateOne({ _id }, { $inc: { stock: quantity } })` — usado para compensação de estoque.
- `orders/orders.service.ts` — `create()` reescrito com fluxo de 8 passos:
  1. Valida produto (404).
  2. Pre-check de idempotência (`findOne({ idempotencyKey })`) → retorna pedido existente sem tocar estoque.
  3. Reserva atômica de estoque (409 se insuficiente).
  4. Cria pedido como `PENDING`; em E11000: restaura estoque via `incrementStock` e retorna o pedido vencedor.
  5. Transição para `PROCESSING`.
  6. Chama `FakeErpService.processOrder()`.
  7. Sucesso → `COMPLETED`.
  8. Falha → `FAILED` + `incrementStock` (compensação de estoque). Retorna pedido FAILED (HTTP 201).
- `orders/orders.module.ts` — importa `ErpModule`.
- `orders/orders.controller.ts` — Swagger atualizado: `@ApiOperation` com fluxo step-by-step, `@ApiCreatedResponse` cobre COMPLETED e FAILED, descrição do status lifecycle em `GET /api/orders/:id`.
- `products/products.service.spec.ts` — 2 novos testes para `incrementStock`.
- `orders/orders.service.spec.ts` — reescrito: `mockErpService` adicionado, `mockOrderModel.updateOne` adicionado; novos testes: fluxo completo COMPLETED, pré-check de idempotência, falha ERP + compensação, E11000 com compensação de estoque, erro não-E11000.
- `test/orders.e2e-spec.ts` — criado: 6 cenários de negócio (Supertest, MongoDB real `casecellshop-e2e`, stub ERP mutável via `overrideProvider`, fresh product + cleanup por teste).
- `test/jest-e2e.json` — `"forceExit": true` adicionado.

**Decisões:**
- Retorno HTTP 201 para pedido FAILED: o pedido existe no banco; o cliente recebe o ID e o motivo da falha; não é necessário endpoint adicional.
- Pre-check de idempotência antes de decrementar estoque: evita duplo decremento em retries normais; índice único + E11000 cobre a race condition residual.
- Compensação via `incrementStock` (sem transação): trade-off documentado — sem replica set no Docker Compose, compensação best-effort é aceitável para o escopo do desafio.
- `FakeErpService` usa `overrideProvider` em todos os testes: zero `Math.random()`, zero fake timers, zero flakiness.
- E2E usa banco dedicado `casecellshop-e2e` + `dropDatabase()` no beforeAll/afterAll: isolamento sem depender de `mongodb-memory-server`.

**Validação:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: 33/33 verdes (4 novos testes de unit adicionados)
- `npm run test:e2e`: 7/7 verdes (6 cenários + health smoke)
- `tsc --noEmit`: limpo
- `nest build`: limpo

---

## Fase 8 — Frontend MVP

**Prompt:** Implement Phase 8 — Frontend MVP. Display products from GET /api/products, allow quantity selection, create orders via POST /api/orders with crypto.randomUUID() Idempotency-Key, show loading state, prevent multiple clicks during processing, display success/error messages with order status and order ID. Use Next.js App Router, TypeScript, no state management libraries. Error handling: 400 / 404 / 409 / 500.

**Resultado:**
- `src/types/index.ts` — `Product`, `Order`, `OrderStatus`, `ApiError` interfaces.
- `src/lib/api/index.ts` — updated with proper types: `api.products.list()` → `Product[]`, `api.orders.create()` → `Order`, `api.orders.findOne()` → `Order`.
- `src/components/ProductCard.tsx` (Client Component):
  - Quantity input (min 1, max = stock) disabled during loading or when out of stock.
  - Buy Now button: disabled + "Processing…" text while loading; prevents multiple submissions.
  - `crypto.randomUUID()` called inside `handleBuy()` — fresh key per attempt.
  - Success state: shows order ID, status, total, failureReason (for FAILED orders); "Buy again" resets to idle.
  - Error mapping: 400 → invalid request, 404 → product not found, 409 → insufficient stock, default → temporary failure.
- `src/app/page.tsx` (Client Component): `useEffect` fetches product list; renders loading spinner, error banner, or responsive product grid (`auto-fill minmax(280px, 1fr)`).
- `src/app/layout.tsx` — metadata updated to "CaseCellShop".

**Decisões:**
- Client Component para a página principal (useEffect + useState): evita complexidade de Server Component vs. Client split para um MVP simples.
- Inline styles em vez de Tailwind classes: garante correto output do build sem configuração adicional de purge; mais previsível para estilos dinâmicos baseados em estado.
- `crypto.randomUUID()` nativo (sem dependência extra): disponível em todos os browsers modernos e Node 20.
- Nenhuma lib de estado (Redux, Zustand, React Query): gerenciamento local com `useState` é suficiente para o escopo.
- Fase 8 e 9 entregues juntas: checkout e listagem estão na mesma tela; separar em duas fases seria overengineering.

**Validação:**
- `npm run lint`: 0 erros, 0 warnings
- `npm run build`: next build limpo (TypeScript limpo, static generation 4/4 páginas)
- `tsc`: limpo

---

## Fase 10 — Redis Cache (Bonus)

**Prompt:** Implement Phase 10 — Redis Cache (Bonus). Cache GET /api/products in Redis (key: products:all, TTL: 60 s, cache-aside). On cache miss: read from MongoDB, store result, return products. On cache hit: return cached products. On stock changes (decrementStock / incrementStock): invalidate cache key. Structured log events: CACHE_HIT, CACHE_MISS, CACHE_INVALIDATED. No CacheInterceptor, no Pub/Sub, no distributed cache, no Redis locks, no new packages. Add unit tests. Update PROJECT_STATUS.md, README.md, PROMPTS.md. Run lint, tests, build.

**Resultado:**
- `products/products.service.ts` — injeção de `REDIS_CLIENT` (ioredis via token do `SharedModule`) e `Logger` do NestJS.
- `findAll()` implementa cache-aside: `redis.get('products:all')` → hit retorna JSON parsed; miss consulta MongoDB, chama `redis.setex('products:all', 60, json)` e retorna produtos.
- `decrementStock()` — chama `redis.del('products:all')` somente quando o documento foi atualizado (resultado não-nulo); loga CACHE_INVALIDATED.
- `incrementStock()` — chama `redis.del('products:all')` após o `updateOne`; loga CACHE_INVALIDATED.
- Log events: `CACHE_HIT key=products:all`, `CACHE_MISS key=products:all`, `CACHE_INVALIDATED key=products:all reason=stock_decremented|stock_incremented`.
- `products/products.service.spec.ts` — adicionado `mockRedisClient` (`get`, `setex`, `del`); 5 novos testes: miss consulta DB e popula cache, hit retorna cache sem consultar DB, decremento bem-sucedido invalida cache, decremento sem estoque NÃO invalida cache, incremento invalida cache.
- Nenhum pacote novo adicionado.

**Decisões:**
- Invalidação somente em `decrementStock` com resultado não-nulo: se o estoque é insuficiente, nenhum dado mudou; invalidar seria falso positivo e aumentaria latência desnecessariamente.
- Retorno do cache como `ProductDocument[]` via cast: o controller serializa para JSON de qualquer forma; sem impacto no contrato da API.
- Logger padrão do NestJS (`@nestjs/common Logger`): interceptado pelo nestjs-pino, produz JSON estruturado em produção sem dependência adicional.
- Token `REDIS_CLIENT` do `SharedModule` (@Global): não há necessidade de reimportar o módulo Redis em `ProductsModule`.

**Validação:**
- `npm run lint`: 0 erros, 0 warnings
- `npm test`: 37/37 verdes (5 novos testes de cache adicionados)
- `nest build`: limpo
- `next build`: limpo

---

## Fase 11 — Production Dockerfiles

**Prompt:** Implement Phase 11 — Production Dockerfiles. Multi-stage Dockerfiles for backend and frontend. docker-compose.yml updated with backend and frontend services. Backend depends on mongo (healthy) + redis (healthy). Frontend uses Next.js standalone output. NEXT_PUBLIC_API_URL injected as build ARG. .env.example files created. Validate with docker compose up --build. Update PROJECT_STATUS.md, README.md, PROMPTS.md.

**Resultado:**
- `apps/backend/Dockerfile` — builder (node:22-alpine, `npm ci`, `nest build`) + production (prod deps only, `node dist/main`).
- `apps/frontend/Dockerfile` — builder (`ARG NEXT_PUBLIC_API_URL`, `npm ci`, `next build`) + production (standalone `node server.js`).
- `apps/frontend/next.config.ts` — adicionado `output: "standalone"` para imagem mínima.
- `apps/backend/.dockerignore` + `apps/frontend/.dockerignore` — excluem `node_modules`, artefatos de build e `.env`.
- `docker-compose.yml` — atualizado com serviços `backend` e `frontend`; backend conecta ao Mongo e Redis via rede Docker; frontend recebe `NEXT_PUBLIC_API_URL` como build ARG.
- `apps/backend/.env.example` + `apps/frontend/.env.example` criados.
- `.env.example` raiz atualizado com todas as variáveis (host ports, build args, backend config).
- `docs/ARCHITECTURE.md` — seção "Container Architecture" adicionada.
- `README.md` — seções "Opção A (Docker)" e tabela de variáveis adicionadas.

**Decisões:**
- `output: "standalone"` no Next.js: gera `server.js` com dependências mínimas — imagem ~214 MB vs >500 MB sem standalone.
- `NEXT_PUBLIC_API_URL` como build ARG: variáveis `NEXT_PUBLIC_*` são embutidas no bundle JS no build time; valor padrão `http://localhost:3001/api` funciona para demo local pois a porta 3001 é mapeada no host.
- `HOSTNAME=0.0.0.0` no frontend: necessário para o servidor standalone aceitar conexões de fora do container.
- `depends_on` com `condition: service_healthy` no backend: evita boot antes do Mongo e Redis estarem prontos; backend tem seed que roda no `OnModuleInit`.
- Sem healthcheck no serviço `backend`: simplifica o compose; o frontend usa `depends_on: backend` (started), aceitável para demo.

**Validação:**
- `docker compose build`: 0 erros; imagens `backend` ~223 MB, `frontend` ~214 MB.
- `docker compose up`: todos os 4 containers sobem; `casecellshop-mongo` e `casecellshop-redis` já estavam (healthy).
- `GET /api/health`: `{"status":"ok","info":{"mongodb":{"status":"up"},"redis":{"status":"up"}}}`.
- `GET /api/products`: 5 produtos do seed.
- `POST /api/orders`: pedido criado com status `COMPLETED`, stock decrementado.
- `GET http://localhost:3000`: frontend servindo HTML.
- Startup único: `docker compose up --build`.

---

## Phase 12 — Final Documentation & Submission Readiness

**Prompt:** Implement Phase 12 — Final Documentation & Submission Readiness. Prepare the
repository for technical evaluation. No new features, no business-logic changes, no test
changes, no API-contract changes, no new dependencies. Documentation must be English-only,
concise, professional, and consistent. Rewrite the README as the primary entry point
(Project Overview with problem → solution mapping, Architecture, Key Technical Decisions,
Running the Project, Environment Variables, API Documentation, Testing, Trade-offs, Future
Improvements). Add Mermaid diagrams to `docs/ARCHITECTURE.md` (System Architecture,
Checkout Flow, Cache Flow). Review ADR-001. Update PROJECT_STATUS to READY FOR SUBMISSION.
Clean up stale references. Validate docs against the implementation.

**Result:**
- `README.md` — rewritten in English as the primary entry point with all required
  sections and the explicit Problem 1 → Redis Cache / Problem 2 → Atomic Stock Control /
  Problem 3 → ERP Resilience + Compensation mapping. Commands verified against
  `package.json`, `docker-compose.yml`, and `.env.example`.
- `docs/ARCHITECTURE.md` — translated to English; added three Mermaid diagrams; corrected
  the ERP-failure outcome to HTTP 201 with `FAILED` status (the implementation never
  returns 503 for ERP failure).
- `docs/ADR-001-monolito-modular.md` — translated to English; clarified why a modular
  monolith, why not microservices, and why it fits the challenge scope.
- `docs/PROJECT_STATUS.md` — added a Submission Status block (READY FOR SUBMISSION / Phase
  12 / None); marked Phase 12 complete; removed stale forward-looking sections
  (`mongodb-memory-server` plan, "Recommended Next Step: Phase 7b", "Recommended execution
  order", "Still missing" item).
- `PROMPTS.md` — this entry added.

**Decisions:**
- Kept the historical phase log in `PROJECT_STATUS.md` and the prior Portuguese prompt
  entries as a development record; only stale forward-looking planning was removed.
- No source code, tests, API contracts, or dependencies were modified.

**Validation:**
- README, ARCHITECTURE, ADR, and env tables cross-checked against `main.ts`,
  `env.validation.ts`, `orders.service.ts`, `orders.controller.ts`,
  `products.service.ts`, `fake-erp.service.ts`, `docker-compose.yml`, `package.json`, and
  `.env.example`.
