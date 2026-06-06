import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../schemas/order.schema';

export class OrderResponseDto {
  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d1',
    description: 'ID único do pedido',
  })
  id: string;

  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d0',
    description: 'ID do produto comprado',
  })
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantidade comprada' })
  quantity: number;

  @ApiProperty({
    example: 39.9,
    description: 'Preço unitário no momento da compra',
  })
  unitPrice: number;

  @ApiProperty({ example: 79.8, description: 'Valor total do pedido' })
  total: number;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Status do pedido: PENDING → PROCESSING → COMPLETED | FAILED',
  })
  status: OrderStatus;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Chave de idempotência do pedido',
  })
  idempotencyKey: string;

  @ApiPropertyOptional({
    example: 'ERP timeout',
    description: 'Motivo da falha (quando FAILED)',
  })
  failureReason?: string;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  updatedAt: Date;
}
