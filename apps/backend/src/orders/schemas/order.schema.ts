import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret['id'] = String(ret['_id']);
      delete ret['_id'];
      if (ret['productId'] instanceof Types.ObjectId) {
        ret['productId'] = ret['productId'].toString();
      }
    },
  },
})
export class Order {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Product' })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  /**
   * Unique idempotency key per order.
   * Prevents duplicate order creation on client retries.
   * The unique index on this field is the source of truth for deduplication.
   */
  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop()
  failureReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
