import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(): Promise<ProductDocument[]> {
    return this.productModel.find().sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<ProductDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.productModel.findById(id).exec();
  }
}
