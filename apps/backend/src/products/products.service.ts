import { Injectable } from '@nestjs/common';

/**
 * Lógica de negócio dos produtos.
 * Schema Mongoose, seed automática e cache Redis chegam na Fase 4.
 */
@Injectable()
export class ProductsService {
  findAll() {
    return [];
  }
}
