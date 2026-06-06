import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';
import { FakeErpService } from '../erp/fake-erp.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
    private readonly erpService: FakeErpService,
  ) {}

  /**
   * Full checkout flow:
   * 1. Validate product (404 if not found).
   * 2. Pre-check idempotency key — return existing order immediately to avoid double stock ops.
   * 3. Atomically reserve stock (409 if insufficient).
   * 4. Persist order as PENDING.
   *    On E11000 (concurrent duplicate): restore stock, return winning order.
   * 5. Transition to PROCESSING.
   * 6. Call FakeErpService.
   * 7. On ERP success: transition to COMPLETED.
   * 8. On ERP failure: transition to FAILED + restore stock (compensation).
   *
   * Returns the order in its final state (COMPLETED or FAILED).
   */
  async create(
    dto: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<OrderDocument> {
    const product = await this.productsService.findById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product not found: ${dto.productId}`);
    }

    // Pre-check: return the existing order without touching stock on retries.
    const existingOrder = await this.orderModel
      .findOne({ idempotencyKey })
      .exec();
    if (existingOrder) return existingOrder;

    const reserved = await this.productsService.decrementStock(
      dto.productId,
      dto.quantity,
    );
    if (!reserved) {
      throw new ConflictException(
        `Insufficient stock for product: ${dto.productId}`,
      );
    }

    const unitPrice = product.price;
    const total = parseFloat((unitPrice * dto.quantity).toFixed(2));

    let order: OrderDocument;
    try {
      order = await this.orderModel.create({
        productId: product._id,
        quantity: dto.quantity,
        unitPrice,
        total,
        status: OrderStatus.PENDING,
        idempotencyKey,
      });
    } catch (error) {
      // Concurrent request with the same key won the race.
      // Restore the stock we decremented and return the winning order.
      if ((error as { code?: number }).code === 11000) {
        await this.productsService.incrementStock(dto.productId, dto.quantity);
        const winning = await this.orderModel
          .findOne({ idempotencyKey })
          .exec();
        if (winning) return winning;
      }
      throw error;
    }

    await this.orderModel
      .updateOne(
        { _id: order._id },
        { $set: { status: OrderStatus.PROCESSING } },
      )
      .exec();

    try {
      await this.erpService.processOrder(String(order._id));
      await this.orderModel
        .updateOne(
          { _id: order._id },
          { $set: { status: OrderStatus.COMPLETED } },
        )
        .exec();
    } catch (erpError) {
      const failureReason =
        erpError instanceof Error ? erpError.message : 'ERP error';
      await this.orderModel
        .updateOne(
          { _id: order._id },
          { $set: { status: OrderStatus.FAILED, failureReason } },
        )
        .exec();
      // Compensate: restore stock so it can be purchased again.
      try {
        await this.productsService.incrementStock(dto.productId, dto.quantity);
      } catch (compensationError) {
        this.logger.error(
          `Stock compensation failed for order ${String(order._id)} ` +
            `(product ${dto.productId}, qty ${dto.quantity}): ` +
            `${(compensationError as Error).message}`,
        );
        throw new InternalServerErrorException(
          'ERP processing failed and stock compensation could not be completed.',
        );
      }
    }

    const final = await this.orderModel.findById(order._id).exec();
    if (!final) {
      throw new NotFoundException(
        `Order not found after creation: ${String(order._id)}`,
      );
    }
    return final;
  }

  async findOne(id: string): Promise<OrderDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Order not found: ${id}`);
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order not found: ${id}`);
    }
    return order;
  }
}
