import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderDocument> {
    const product = await this.productsService.findById(dto.productId);
    if (!product) {
      throw new NotFoundException(`Product not found: ${dto.productId}`);
    }

    const unitPrice = product.price;
    const total = parseFloat((unitPrice * dto.quantity).toFixed(2));

    return this.orderModel.create({
      productId: product._id,
      quantity: dto.quantity,
      unitPrice,
      total,
      status: OrderStatus.PENDING,
      idempotencyKey: randomUUID(),
    });
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
