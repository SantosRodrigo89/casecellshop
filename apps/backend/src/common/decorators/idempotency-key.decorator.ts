import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extrai o header Idempotency-Key do request.
 * Usado nos controllers de Orders para garantir idempotência no POST /orders.
 *
 * Uso: @IdempotencyKey() key: string
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['idempotency-key'] as string | undefined;
  },
);
