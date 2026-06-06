import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsNotEmpty, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d0',
    description: 'Product ID (MongoDB ObjectId)',
  })
  @IsNotEmpty({ message: 'productId is required' })
  @IsMongoId({ message: 'productId must be a valid ObjectId' })
  productId: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity to purchase (minimum 1)',
    minimum: 1,
  })
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;
}
