'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '@/types';

interface Props {
  product: Product;
  quantity: number;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

interface RowProps {
  label: string;
  value: string;
  large?: boolean;
  highlight?: boolean;
}

function Row({ label, value, large = false, highlight = false }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        paddingBottom: '14px',
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: large ? '1rem' : highlight ? '1.125rem' : '0.9375rem',
          fontWeight: large ? 700 : highlight ? 800 : 600,
          color: highlight ? '#0f172a' : '#1e293b',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function CheckoutDrawer({ product, quantity, isLoading, onClose, onConfirm }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const total = product.price * quantity;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onClose]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();
  }, []);

  function handleTabTrap(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={isLoading ? undefined : onClose}
        className="checkout-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.52)',
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Resumo do pedido"
        onKeyDown={handleTabTrap}
        className="checkout-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: 'min(420px, 100vw)',
          backgroundColor: '#ffffff',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 32px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Resumo do Pedido
          </h2>
          <button
            onClick={isLoading ? undefined : onClose}
            disabled={isLoading}
            aria-label="Fechar resumo do pedido"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1,
              padding: '4px 6px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Product image */}
          <div
            style={{
              height: '180px',
              borderRadius: '12px',
              background: 'linear-gradient(160deg, #f0f9ff 0%, #f1f5f9 100%)',
              overflow: 'hidden',
              marginBottom: '24px',
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
                  fontSize: '3rem',
                  color: '#94a3b8',
                }}
              >
                📱
              </div>
            )}
          </div>

          {/* Order summary rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <Row label="Produto" value={product.name} large />
            <Row label="Preço unitário" value={`R$ ${product.price.toFixed(2)}`} />
            <Row label="Quantidade" value={String(quantity)} />
            <Row label="Total" value={`R$ ${total.toFixed(2)}`} highlight />
            <Row label="Estoque disponível" value={`${product.stock} unidades`} />
          </div>

          {/* Reservation info */}
          <div
            style={{
              marginTop: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#0369a1', lineHeight: '1.55' }}>
              ℹ️ Ao confirmar, o estoque será reservado imediatamente. Em caso de falha no
              processamento, a reserva é automaticamente estornada.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
            aria-label={isLoading ? 'Processando compra' : `Confirmar compra de ${product.name}`}
            style={{
              padding: '13px 0',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isLoading ? '#94a3b8' : '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9375rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {isLoading ? 'Processando…' : 'Confirmar Compra'}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cancelar e fechar"
            style={{
              padding: '11px 0',
              borderRadius: '8px',
              border: '1.5px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
