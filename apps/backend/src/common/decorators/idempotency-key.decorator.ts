import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts the Idempotency-Key header from the incoming request.
 * Used in the Orders controller to prevent duplicate order creation.
 *
 * Usage: @IdempotencyKey() key: string
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['idempotency-key'] as string | undefined;
  },
);
