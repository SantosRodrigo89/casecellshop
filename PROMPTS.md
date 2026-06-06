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
