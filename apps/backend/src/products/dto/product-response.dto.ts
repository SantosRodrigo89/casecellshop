import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d0',
    description: 'Unique product ID',
  })
  id: string;

  @ApiProperty({ example: 'Capinha iPhone 15', description: 'Product name' })
  name: string;

  @ApiProperty({
    example: 'capinha-iphone-15',
    description: 'URL-friendly unique slug',
  })
  slug: string;

  @ApiProperty({ example: 39.9, description: 'Price in BRL' })
  price: number;

  @ApiProperty({ example: 50, description: 'Units available in stock' })
  stock: number;

  @ApiPropertyOptional({
    example: 'https://placehold.co/400x400?text=iPhone+15',
    description: 'Product image URL',
  })
  imageUrl?: string;

  @ApiProperty({
    example: '2026-06-06T12:00:00.000Z',
    description: 'ISO-8601 timestamp of product creation',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-06-06T12:00:00.000Z',
    description: 'ISO-8601 timestamp of last update',
  })
  updatedAt: Date;
}
