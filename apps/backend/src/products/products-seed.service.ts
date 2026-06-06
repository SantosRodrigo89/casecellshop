import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { PRODUCT_SEEDS } from './products.seed';

/**
 * Automatic product seed service.
 * Kept separate from ProductsService to maintain single responsibility and allow
 * independent unit testing of each concern.
 *
 * Runs on module init via OnModuleInit, only when the collection is empty.
 * Idempotent: subsequent restarts never create duplicate records.
 */
@Injectable()
export class ProductsSeedService implements OnModuleInit {
  private readonly logger = new Logger(ProductsSeedService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runSeed();
  }

  async runSeed(): Promise<void> {
    const count = await this.productModel.countDocuments();
    if (count > 0) {
      this.logger.log(
        `Seed skipped — ${count} product(s) already in the collection.`,
      );
      return;
    }
    await this.productModel.insertMany(PRODUCT_SEEDS);
    this.logger.log(
      `Seed complete — ${PRODUCT_SEEDS.length} products inserted.`,
    );
  }
}
