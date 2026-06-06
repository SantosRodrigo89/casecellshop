import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * Vitrine de produtos.
 * Schema, seed e implementação real chegam na Fase 4.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }
}
