'use client';

import { useState } from 'react';
import type { Product, Order, ApiError } from '@/types';
import { api } from '@/lib/api';
import CheckoutDrawer from '@/components/CheckoutDrawer';

interface Props {
  product: Product;
  onPurchased: () => void;
}

type CheckoutState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; order: Order }
  | { type: 'error'; message: string };

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

export default function ProductCard({ product, onPurchased }: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<CheckoutState>({ type: 'idle' });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLoading = state.type === 'loading';
  const outOfStock = product.stock === 0;

  function openDrawer() {
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  async function handleConfirm() {
    setState({ type: 'loading' });
    const idempotencyKey = crypto.randomUUID();
    try {
      const order = await api.orders.create({ productId: product.id, quantity }, idempotencyKey);
      onPurchased();
      setState({ type: 'success', order });
    } catch (err) {
      setState({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setDrawerOpen(false);
    }
  }

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) setQuantity(value);
  }

  function handleReset() {
    setState({ type: 'idle' });
    setQuantity(1);
  }

  const isCompleted = state.type === 'success' && state.order.status === 'COMPLETED';

  return (
    <article
      aria-label={`Produto: ${product.name}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 16px 40px rgba(0,0,0,0.12)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image */}
      <div
        style={{
          height: '220px',
          background: 'linear-gradient(160deg, #f0f9ff 0%, #f1f5f9 100%)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={`Foto de ${product.name}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '16px',
              transition: 'transform 0.3s ease',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '2.5rem',
            }}
          >
            📱
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Product info */}
        <div>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              margin: '0 0 6px 0',
              color: '#1e293b',
              lineHeight: '1.4',
            }}
          >
            {product.name}
          </h2>
          <p
            aria-label={`Preço: R$ ${product.price.toFixed(2)}`}
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              margin: '0 0 4px 0',
              color: '#0f172a',
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            R$ {product.price.toFixed(2)}
          </p>
          <p
            aria-live="polite"
            style={{
              fontSize: '0.8125rem',
              color: outOfStock ? '#ef4444' : '#64748b',
              margin: 0,
            }}
          >
            {outOfStock ? 'Sem estoque' : `${product.stock} em estoque`}
          </p>
        </div>

        {/* Checkout */}
        {state.type !== 'success' && (
          <>
            {!outOfStock && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label
                  htmlFor={`qty-${product.id}`}
                  style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}
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
                  disabled={isLoading}
                  aria-label={`Quantidade de ${product.name}`}
                  aria-disabled={isLoading}
                  style={{
                    width: '72px',
                    padding: '6px 10px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    textAlign: 'center',
                    backgroundColor: isLoading ? '#f8fafc' : '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <button
              onClick={openDrawer}
              disabled={outOfStock}
              aria-disabled={outOfStock}
              aria-label={outOfStock ? `${product.name} sem estoque` : `Comprar ${product.name}`}
              style={{
                padding: '11px 0',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: outOfStock ? '#94a3b8' : '#0f172a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: outOfStock ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {outOfStock ? 'Sem estoque' : 'Comprar'}
            </button>
          </>
        )}

        {state.type === 'error' && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.8125rem',
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
              borderRadius: '8px',
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
              {isCompleted ? '✓ Pedido confirmado!' : '⚠ Pedido com ressalvas'}
            </p>
            <p style={detailTextStyle}>
              <strong>ID:</strong> {state.order.id}
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
                padding: '7px 14px',
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
      </div>

      {drawerOpen && (
        <CheckoutDrawer
          product={product}
          quantity={quantity}
          isLoading={isLoading}
          onClose={closeDrawer}
          onConfirm={handleConfirm}
        />
      )}
    </article>
  );
}
