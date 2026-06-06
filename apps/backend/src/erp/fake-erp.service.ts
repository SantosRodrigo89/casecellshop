import { Injectable } from '@nestjs/common';

export type ErpFailureMode = 'never' | 'always' | 'rate';

/**
 * Simula um ERP externo com latência artificial e falha controlada.
 *
 * Comportamento configurado por variáveis de ambiente:
 *   ERP_FAILURE_MODE=never   → sempre sucesso (padrão, ideal para demo)
 *   ERP_FAILURE_MODE=always  → sempre falha (útil para testes manuais)
 *   ERP_FAILURE_MODE=rate    → falha probabilística
 *   ERP_LATENCY_MS           → latência artificial em ms
 *   ERP_TIMEOUT_MS           → timeout máximo da chamada
 *
 * Em testes E2E, o provider é sobrescrito via overrideProvider() para garantir
 * comportamento determinístico sem depender de Math.random() ou timers reais.
 *
 * Implementação completa (timeout real + compensação de estoque) chega na Fase 6.
 */
@Injectable()
export class FakeErpService {
  async processOrder(_orderId: string): Promise<void> {
    // placeholder — implementação na Fase 6
  }
}
