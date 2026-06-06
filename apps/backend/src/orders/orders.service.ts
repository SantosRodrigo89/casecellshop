import { Injectable } from '@nestjs/common';

/**
 * Lógica de checkout: validação de quantidade, decremento atômico de estoque,
 * idempotência por Idempotency-Key e integração com FakeErpService.
 * Implementação completa nas Fases 5 e 6.
 */
@Injectable()
export class OrdersService {
  create(_body: unknown) {
    return { message: 'not implemented' };
  }

  findOne(_id: string) {
    return { message: 'not implemented' };
  }
}
