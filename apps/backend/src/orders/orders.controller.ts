import {
  BadRequestException,
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
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key (UUID recommended) to prevent duplicate order creation on client retries. ' +
      'A second request with the same key returns the existing order without creating a new one.',
  })
  @ApiOperation({
    summary: 'Create order',
    description:
      'Requires the Idempotency-Key header (400 if missing). ' +
      'Validates the product (404 if not found), atomically reserves stock via a single ' +
      'findOneAndUpdate operation (409 if quantity exceeds available stock), then persists ' +
      'the order. A duplicate Idempotency-Key (E11000) returns the existing order. ' +
      'Returns the created order with PENDING status.',
  })
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description:
      'Order created (or existing order returned for a duplicate Idempotency-Key).',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Invalid request — missing Idempotency-Key header, or productId/quantity is incorrect.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Product not found.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'Insufficient stock — the requested quantity exceeds available stock.',
  })
  create(
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.create(dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Returns the order and its current status: PENDING | PROCESSING | COMPLETED | FAILED.',
  })
  @ApiOkResponse({ type: OrderResponseDto, description: 'Order found.' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Order not found.',
  })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
