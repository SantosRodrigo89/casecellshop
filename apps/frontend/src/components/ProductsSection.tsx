'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Product } from '@/types';
import { api } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

interface Props {
  initialProducts: Product[];
}

export function ProductsSection({ initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    return api.products
      .list()
      .then(setProducts)
      .catch(() =>
        setError(
          'Não foi possível recarregar os produtos. Verifique se o servidor está em execução.',
        ),
      );
  }, []);

  // Fallback: se o ISR não trouxe produtos (falha no build-time), busca client-side
  useEffect(() => {
    if (initialProducts.length === 0) {
      fetchProducts().finally(() => setLoading(false));
    }
  }, [initialProducts.length, fetchProducts]);

  return (
    <main
      id="produtos"
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '48px 24px',
        flex: 1,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
        Capinhas para Celular
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '0.875rem' }}>
        Escolha sua capinha e finalize sua compra em segundos.
      </p>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Carregando produtos"
          style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}
        >
          Carregando produtos…
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '16px 20px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div
          role="status"
          style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}
        >
          Nenhum produto disponível.
        </div>
      )}

      {products.length > 0 && (
        <div
          aria-label="Lista de produtos"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPurchased={fetchProducts}
            />
          ))}
        </div>
      )}
    </main>
  );
}
