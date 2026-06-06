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

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  backgroundColor: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const detailTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#374151',
  margin: '0 0 2px 0',
};

function getErrorMessage(err: unknown): string {
  const e = err as ApiError;
  switch (e.status) {
    case 400:
      return 'Requisição inválida. Verifique a quantidade informada.';
    case 404:
      return 'Produto não encontrado.';
    case 409:
      return 'Estoque insuficiente para este produto.';
    default:
      return 'Falha temporária no processamento. Tente novamente em instantes.';
  }
}

export default function ProductCard({ product }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<CheckoutState>({ type: 'idle' });

  const isLoading = state.type === 'loading';
  const outOfStock = product.stock === 0;

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

  const isCompleted = state.type === 'success' && state.order.status === 'COMPLETED';

  return (
    <article aria-label={`Produto: ${product.name}`} style={cardStyle}>
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={`Foto de ${product.name}`}
          style={{
            width: '100%',
            height: '180px',
            objectFit: 'cover',
            borderRadius: '6px',
            backgroundColor: '#f3f4f6',
          }}
        />
      )}

      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 4px 0', color: '#111827' }}>
          {product.name}
        </h2>
        <p
          aria-label={`Preço: R$ ${product.price.toFixed(2)}`}
          style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px 0', color: '#111827' }}
        >
          R$ {product.price.toFixed(2)}
        </p>
        <p
          aria-live="polite"
          style={{ fontSize: '0.875rem', color: outOfStock ? '#ef4444' : '#6b7280', margin: 0 }}
        >
          {outOfStock ? 'Sem estoque' : `${product.stock} em estoque`}
        </p>
      </div>

      {state.type !== 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label
            htmlFor={`qty-${product.id}`}
            style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}
          >
            Quantidade:
          </label>
          <input
            id={`qty-${product.id}`}
            type="number"
            min={1}
            max={product.stock}
            value={quantity}
            onChange={handleQuantityChange}
            disabled={isLoading || outOfStock}
            aria-label={`Quantidade de ${product.name}`}
            aria-disabled={isLoading || outOfStock}
            style={{
              width: '70px',
              padding: '6px 10px',
              border: '2px solid #6b7280',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#111827',
              textAlign: 'center',
              backgroundColor: isLoading || outOfStock ? '#f3f4f6' : '#ffffff',
              outline: 'none',
            }}
          />
        </div>
      )}

      {state.type !== 'success' && (
        <button
          onClick={handleBuy}
          disabled={isLoading || outOfStock}
          aria-busy={isLoading}
          aria-disabled={isLoading || outOfStock}
          aria-label={
            isLoading
              ? `Processando compra de ${product.name}`
              : outOfStock
                ? `${product.name} sem estoque`
                : `Comprar ${product.name}`
          }
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
          {isLoading ? 'Processando…' : outOfStock ? 'Sem estoque' : 'Comprar'}
        </button>
      )}

      {state.type === 'error' && (
        <div
          role="alert"
          aria-live="assertive"
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
          role="status"
          aria-live="polite"
          aria-label={isCompleted ? 'Pedido confirmado' : 'Pedido processado com ressalvas'}
          style={{
            padding: '14px',
            borderRadius: '6px',
            backgroundColor: isCompleted ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${isCompleted ? '#bbf7d0' : '#fde68a'}`,
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: '0.875rem',
              margin: '0 0 6px 0',
              color: isCompleted ? '#15803d' : '#b45309',
            }}
          >
            {isCompleted ? '✓ Pedido confirmado!' : '⚠ Pedido processado com ressalvas'}
          </p>
          <p style={detailTextStyle}>
            <strong>ID do pedido:</strong> {state.order.id}
          </p>
          <p style={detailTextStyle}>
            <strong>Status:</strong> {state.order.status}
          </p>
          <p style={detailTextStyle}>
            <strong>Total:</strong> R$ {state.order.total.toFixed(2)}
          </p>
          {state.order.failureReason && (
            <p style={{ ...detailTextStyle, color: '#b45309', marginTop: '4px' }}>
              <strong>Motivo:</strong> {state.order.failureReason}
            </p>
          )}
          <button
            onClick={handleReset}
            aria-label={`Comprar ${product.name} novamente`}
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
            Comprar novamente
          </button>
        </div>
      )}
    </article>
  );
}
