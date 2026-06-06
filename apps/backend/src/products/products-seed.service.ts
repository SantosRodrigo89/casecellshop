import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { PRODUCT_SEEDS } from './products.seed';

/**
 * Seed automática da coleção de produtos.
 * Separada do ProductsService para manter o serviço focado em regras de negócio
 * e permitir testar cada responsabilidade de forma independente.
 *
 * Executada no boot via OnModuleInit, apenas quando a coleção estiver vazia.
 * Idempotente: reinicializações não duplicam registros.
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
