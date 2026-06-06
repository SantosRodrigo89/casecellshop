import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Gerencia criação e consulta de pedidos.
 * Idempotência (Idempotency-Key), decremento atômico de estoque e integração
 * com ERP chegam na Fase 5 (core) e Fase 6 (ERP).
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.ordersService.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
