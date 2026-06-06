'use client';

import { useState } from 'react';
import type { Product, Order, ApiError } from '@/types';
import { api } from '@/lib/api';

interface Props {
  product: Product;
}

type CheckoutState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; order: Order }
  | { type: 'error'; message: string };

function getErrorMessage(err: unknown): string {
  const e = err as ApiError;
  switch (e.status) {
    case 400:
      return 'Invalid request. Please check the quantity.';
    case 404:
      return 'Product not found.';
    case 409:
      return 'Insufficient stock for this product.';
    default:
      return 'Temporary processing failure. Please try again later.';
  }
}

export default function ProductCard({ product }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<CheckoutState>({ type: 'idle' });

  const isLoading = state.type === 'loading';

  async function handleBuy() {
    setState({ type: 'loading' });
    const idempotencyKey = crypto.randomUUID();
    try {
      const order = await api.orders.create({ productId: product.id, quantity }, idempotencyKey);
      setState({ type: 'success', order });
    } catch (err) {
      setState({ type: 'error', message: getErrorMessage(err) });
    }
  }

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  }

  function handleReset() {
    setState({ type: 'idle' });
    setQuantity(1);
  }

  const outOfStock = product.stock === 0;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 4px 0', color: '#111827' }}>
          {product.name}
        </h2>
        <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px 0', color: '#111827' }}>
          R$ {product.price.toFixed(2)}
        </p>
        <p style={{ fontSize: '0.875rem', color: outOfStock ? '#ef4444' : '#6b7280', margin: 0 }}>
          {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
        </p>
      </div>

      {state.type !== 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor={`qty-${product.id}`} style={{ fontSize: '0.875rem', color: '#374151' }}>
            Qty:
          </label>
          <input
            id={`qty-${product.id}`}
            type="number"
            min={1}
            max={product.stock}
            value={quantity}
            onChange={handleQuantityChange}
            disabled={isLoading || outOfStock}
            style={{
              width: '70px',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          />
        </div>
      )}

      {state.type !== 'success' && (
        <button
          onClick={handleBuy}
          disabled={isLoading || outOfStock}
          style={{
            padding: '10px 0',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: isLoading || outOfStock ? '#9ca3af' : '#111827',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: isLoading || outOfStock ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {isLoading ? 'Processing…' : outOfStock ? 'Out of Stock' : 'Buy Now'}
        </button>
      )}

      {state.type === 'error' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.875rem',
          }}
        >
          {state.message}
        </div>
      )}

      {state.type === 'success' && (
        <div
          style={{
            padding: '14px',
            borderRadius: '6px',
            backgroundColor: state.order.status === 'COMPLETED' ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${state.order.status === 'COMPLETED' ? '#bbf7d0' : '#fde68a'}`,
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: '0.875rem',
              margin: '0 0 6px 0',
              color: state.order.status === 'COMPLETED' ? '#15803d' : '#b45309',
            }}
          >
            {state.order.status === 'COMPLETED' ? '✓ Order confirmed!' : '⚠ Order processed with issues'}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#374151', margin: '0 0 2px 0' }}>
            <strong>Order ID:</strong> {state.order.id}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#374151', margin: '0 0 2px 0' }}>
            <strong>Status:</strong> {state.order.status}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#374151', margin: '0 0 2px 0' }}>
            <strong>Total:</strong> R$ {state.order.total.toFixed(2)}
          </p>
          {state.order.failureReason && (
            <p style={{ fontSize: '0.8rem', color: '#b45309', margin: '4px 0 0 0' }}>
              <strong>Reason:</strong> {state.order.failureReason}
            </p>
          )}
          <button
            onClick={handleReset}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Buy again
          </button>
        </div>
      )}
    </div>
  );
}
