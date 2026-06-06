import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../schemas/order.schema';

export class OrderResponseDto {
  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d1',
    description: 'Unique order ID',
  })
  id: string;

  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d0',
    description: 'ID of the purchased product',
  })
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity purchased' })
  quantity: number;

  @ApiProperty({
    example: 39.9,
    description: 'Unit price at the time of purchase',
  })
  unitPrice: number;

  @ApiProperty({ example: 79.8, description: 'Order total' })
  total: number;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Order status: PENDING → PROCESSING → COMPLETED | FAILED',
  })
  status: OrderStatus;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Idempotency key for the order',
  })
  idempotencyKey: string;

  @ApiPropertyOptional({
    example: 'ERP timeout',
    description: 'Failure reason (only present when status is FAILED)',
  })
  failureReason?: string;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  updatedAt: Date;
}
