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

  /**
   * Atomically decrements stock by `quantity` only when enough stock is available.
   * Returns the pre-update document on success, or null when stock < quantity.
   * A single findOneAndUpdate call prevents overselling under concurrent requests.
   */
  async decrementStock(
    id: string,
    quantity: number,
  ): Promise<ProductDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.productModel
      .findOneAndUpdate(
        { _id: id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: false }, // return the pre-update document (price is unchanged by $inc)
      )
      .exec();
  }
}
