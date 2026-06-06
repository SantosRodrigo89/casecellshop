import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
  ) {}

  async create(
    dto: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<OrderDocument> {
    const product = await this.productsService.findById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product not found: ${dto.productId}`);
    }

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

    try {
      return await this.orderModel.create({
        productId: product._id,
        quantity: dto.quantity,
        unitPrice,
        total,
        status: OrderStatus.PENDING,
        idempotencyKey,
      });
    } catch (error) {
      // Duplicate idempotencyKey: return the existing order instead of creating a new one.
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.orderModel
          .findOne({ idempotencyKey })
          .exec();
        if (existing) return existing;
      }
      throw error;
    }
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
