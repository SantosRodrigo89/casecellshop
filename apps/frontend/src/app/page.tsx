'use client';

import { useState, useEffect } from 'react';
import type { Product } from '@/types';
import { api } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products
      .list()
      .then(setProducts)
      .catch(() => setError('Failed to load products. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <header
        style={{
          backgroundColor: '#111827',
          color: '#ffffff',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>
          CaseCellShop
        </span>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Phone Cases
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '0.875rem' }}>
          Choose your phone case and complete your order in seconds.
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}>
            Loading products…
          </div>
        )}

        {error && (
          <div
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
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}>
            No products available.
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
