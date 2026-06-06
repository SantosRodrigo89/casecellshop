/**
 * DTO de criação de pedido.
 * Validação com class-validator e decorators do Swagger chegam na Fase 5.
 */
export class CreateOrderDto {
  productId: string;
  quantity: number;
}
