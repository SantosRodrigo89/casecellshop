/**
 * DTO de resposta de pedido.
 * Expõe o ciclo de status: PENDING → PROCESSING → COMPLETED | FAILED.
 */
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export class OrderResponseDto {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  idempotencyKey: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
