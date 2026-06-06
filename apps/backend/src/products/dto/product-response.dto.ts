/**
 * DTO de resposta para um produto.
 * Decorators do @nestjs/swagger e class-validator chegam na Fase 3.
 */
export class ProductResponseDto {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
