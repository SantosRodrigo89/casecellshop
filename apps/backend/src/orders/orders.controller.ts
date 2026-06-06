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
      'A repeat request with the same key returns the existing order without side effects.',
  })
  @ApiOperation({
    summary: 'Create order',
    description:
      'Full checkout flow:\n' +
      '1. Requires `Idempotency-Key` header (400 if missing).\n' +
      '2. Validates the product (404 if not found).\n' +
      '3. Returns the existing order immediately when the key is already known (idempotent retry).\n' +
      '4. Atomically reserves stock via a single `findOneAndUpdate` (409 if insufficient).\n' +
      '5. Persists the order as **PENDING**.\n' +
      '6. Transitions to **PROCESSING** and calls the ERP.\n' +
      '7. On ERP success → **COMPLETED**; stock remains decremented.\n' +
      '8. On ERP failure → **FAILED**; stock is atomically restored (compensation).\n\n' +
      'Always returns HTTP 201 with the final order. Check `status` for the outcome.',
  })
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description:
      'Order created and processed. ' +
      '`status: COMPLETED` on success; `status: FAILED` when ERP is unavailable ' +
      '(stock automatically restored in both retries and failures).',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Invalid request — missing `Idempotency-Key` header, or `productId`/`quantity` is incorrect.',
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
      'Returns the order and its current status.\n\n' +
      '**Status lifecycle:** `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`\n\n' +
      'When `status` is `FAILED`, the `failureReason` field contains the ERP error message ' +
      'and stock has already been restored.',
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
