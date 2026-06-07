export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  idempotencyKey: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  status: number;
  statusCode?: number;
  message?: string;
}
