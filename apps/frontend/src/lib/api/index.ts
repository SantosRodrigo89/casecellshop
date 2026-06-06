import type { Product, Order } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { status: response.status, ...error };
  }

  return response.json() as Promise<T>;
}

export const api = {
  products: {
    list: () => apiFetch<Product[]>('/products'),
  },
  orders: {
    create: (body: { productId: string; quantity: number }, idempotencyKey: string) =>
      apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    findOne: (id: string) => apiFetch<Order>(`/orders/${id}`),
  },
  health: {
    check: () => apiFetch<{ status: string }>('/health'),
  },
};
