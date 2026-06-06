import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create order',
    description:
      'Creates a new order after validating the product and quantity. Returns the order with PENDING status.',
  })
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description: 'Order created successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body — productId or quantity is incorrect.',
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description:
      'Insufficient stock — the requested quantity exceeds available stock.',
  })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Returns the order and its current status: PENDING | PROCESSING | COMPLETED | FAILED.',
  })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order found.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
