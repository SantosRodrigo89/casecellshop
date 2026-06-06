import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import type Redis from 'ioredis';
import { Product, ProductDocument } from './schemas/product.schema';
import { REDIS_CLIENT } from '../shared/redis.constants';

const PRODUCTS_CACHE_KEY = 'products:all';
const PRODUCTS_CACHE_TTL = 60;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async findAll(): Promise<ProductDocument[]> {
    const cached = await this.redis.get(PRODUCTS_CACHE_KEY);

    if (cached) {
      this.logger.log(`CACHE_HIT key=${PRODUCTS_CACHE_KEY}`);
      return JSON.parse(cached) as ProductDocument[];
    }

    this.logger.log(`CACHE_MISS key=${PRODUCTS_CACHE_KEY}`);
    const products = await this.productModel.find().sort({ name: 1 }).exec();
    await this.redis.setex(
      PRODUCTS_CACHE_KEY,
      PRODUCTS_CACHE_TTL,
      JSON.stringify(products),
    );
    return products;
  }

  async findById(id: string): Promise<ProductDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.productModel.findById(id).exec();
  }

  /**
   * Atomically decrements stock by `quantity` only when enough stock is available.
   * Returns the pre-update document on success, or null when stock < quantity.
   * A single findOneAndUpdate call prevents overselling under concurrent requests.
   * Invalidates the products cache on success so the next GET /api/products reflects
   * the updated stock count.
   */
  async decrementStock(
    id: string,
    quantity: number,
  ): Promise<ProductDocument | null> {
    if (!isValidObjectId(id)) return null;
    const updated = await this.productModel
      .findOneAndUpdate(
        { _id: id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: false }, // return the pre-update document (price is unchanged by $inc)
      )
      .exec();

    if (updated) {
      await this.redis.del(PRODUCTS_CACHE_KEY);
      this.logger.log(
        `CACHE_INVALIDATED key=${PRODUCTS_CACHE_KEY} reason=stock_decremented`,
      );
    }

    return updated;
  }

  /**
   * Atomically increments stock by `quantity`.
   * Used for stock compensation when ERP processing fails after stock was reserved.
   * Invalidates the products cache so the next GET /api/products reflects the restored
   * stock count.
   */
  async incrementStock(id: string, quantity: number): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.productModel
      .updateOne({ _id: id }, { $inc: { stock: quantity } })
      .exec();
    await this.redis.del(PRODUCTS_CACHE_KEY);
    this.logger.log(
      `CACHE_INVALIDATED key=${PRODUCTS_CACHE_KEY} reason=stock_incremented`,
    );
  }
}
