import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({
    example: '6650a1b2c3d4e5f6a7b8c9d0',
    description: 'ID único do produto',
  })
  id: string;

  @ApiProperty({ example: 'Capinha iPhone 15', description: 'Nome do produto' })
  name: string;

  @ApiProperty({
    example: 'capinha-iphone-15',
    description: 'Slug único para URL',
  })
  slug: string;

  @ApiProperty({ example: 39.9, description: 'Preço em reais' })
  price: number;

  @ApiProperty({ example: 50, description: 'Quantidade em estoque' })
  stock: number;

  @ApiPropertyOptional({
    example: 'https://placehold.co/400x400?text=iPhone+15',
    description: 'URL da imagem do produto',
  })
  imageUrl?: string;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-06T12:00:00.000Z' })
  updatedAt: Date;
}
