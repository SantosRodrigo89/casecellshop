# ADR-001: Monólito Modular em vez de Microsserviços Reais

**Status:** Aceito  
**Data:** 2026-06-06

## Contexto

A vaga menciona microsserviços como parte da stack. O desafio pede um mini-fluxo de checkout simples (listagem de produtos + compra). A janela de entrega é curta.

## Decisão

Utilizar um monólito modular NestJS com fronteiras claras por domínio (módulos `products`, `orders`, `erp`, `health`, `shared`), sem comunicação entre processos.

## Consequências

**Positivas:**
- Delivery mais rápido e confiável dentro do prazo.
- Testabilidade máxima sem orquestração de múltiplos serviços em CI.
- Fronteiras de módulo demonstram conhecimento de domínio e coesão.
- Pronto para extração em microsserviços: cada módulo NestJS pode virar um serviço independente sem alterar as interfaces.

**Negativas / Mitigações:**
- Não demonstra comunicação inter-serviço real (HTTP/gRPC/mensageria).
- Mitigação: documentado no README como evolução futura; `ErpModule` simula a fronteira de um serviço externo.

## Por que não Kafka / RabbitMQ

O fluxo de checkout é síncrono e simples. Mensageria adicionaria overhead operacional e complexidade de teste desproporcional ao escopo. Citado no README como evolução futura para processamento assíncrono de pedidos em escala.

## Por que não Kubernetes

Docker Compose cobre o ambiente de desenvolvimento e demonstração. K8s seria operacionalmente desproporcional para um mini-projeto de checkout. Citado no README como destino natural de produção.

## Por que não CQRS / Event Sourcing

O volume de dados e a complexidade das queries não justificam a separação de modelos de leitura e escrita. O padrão repository simples com Mongoose é suficiente e mais legível.
