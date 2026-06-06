import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ErpFailureMode = 'never' | 'always' | 'rate';

/**
 * Simulates an external ERP with artificial latency and configurable failures.
 *
 * Behaviour is controlled by environment variables:
 *   ERP_FAILURE_MODE=never   — always succeeds (default, safe for demo)
 *   ERP_FAILURE_MODE=always  — always fails (useful for manual testing)
 *   ERP_FAILURE_MODE=rate    — probabilistic failure (~30% of requests)
 *   ERP_LATENCY_MS           — artificial delay in milliseconds (default: 500)
 *   ERP_TIMEOUT_MS           — maximum call duration before timeout error (default: 3000)
 *
 * When latencyMs >= timeoutMs the call always times out.
 *
 * In E2E tests the provider is replaced via overrideProvider() to guarantee
 * deterministic behaviour without relying on Math.random() or real timers.
 */
@Injectable()
export class FakeErpService {
  private readonly failureMode: ErpFailureMode;
  private readonly latencyMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.failureMode = this.configService.get<string>(
      'erp.failureMode',
      'never',
    ) as ErpFailureMode;
    this.latencyMs = this.configService.get<number>('erp.latencyMs') ?? 500;
    this.timeoutMs = this.configService.get<number>('erp.timeoutMs') ?? 3000;
  }

  async processOrder(_orderId: string): Promise<void> {
    await this.simulateLatency();
    this.applyFailureMode();
  }

  /**
   * Waits for latencyMs unless timeoutMs fires first.
   * If latencyMs >= timeoutMs the call always times out.
   */
  private simulateLatency(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`ERP timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      setTimeout(() => {
        clearTimeout(timeoutHandle);
        resolve();
      }, this.latencyMs);
    });
  }

  private applyFailureMode(): void {
    if (this.failureMode === 'always') {
      throw new Error('ERP processing failed');
    }
    if (this.failureMode === 'rate' && Math.random() < 0.3) {
      throw new Error('ERP processing failed (rate)');
    }
  }
}
