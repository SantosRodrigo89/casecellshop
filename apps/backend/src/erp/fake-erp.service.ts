import { Injectable } from '@nestjs/common';

export type ErpFailureMode = 'never' | 'always' | 'rate';

/**
 * Simulates an external ERP with artificial latency and configurable failures.
 *
 * Behaviour is controlled by environment variables:
 *   ERP_FAILURE_MODE=never   — always succeeds (default, ideal for demo)
 *   ERP_FAILURE_MODE=always  — always fails (useful for manual testing)
 *   ERP_FAILURE_MODE=rate    — probabilistic failure
 *   ERP_LATENCY_MS           — artificial delay in milliseconds
 *   ERP_TIMEOUT_MS           — maximum call timeout
 *
 * In E2E tests the provider is replaced via overrideProvider() to guarantee
 * deterministic behaviour without relying on Math.random() or real timers.
 */
@Injectable()
export class FakeErpService {
  async processOrder(_orderId: string): Promise<void> {
    // Full implementation with timeout and stock compensation arrives in Phase 6.
  }
}
