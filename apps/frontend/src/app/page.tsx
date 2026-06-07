'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/types';
import { api } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

const HIGHLIGHTS = [
  'Estoque em tempo real',
  'Proteção contra compras duplicadas',
  'Integração ERP resiliente',
];

const TECH_STACK = ['Next.js', 'NestJS', 'MongoDB', 'Redis'];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    return api.products
      .list()
      .then(setProducts)
      .catch(() =>
        setError(
          'Não foi possível carregar os produtos. Verifique se o servidor está em execução.',
        ),
      );
  }, []);

  useEffect(() => {
    fetchProducts().finally(() => setLoading(false));
  }, [fetchProducts]);

  function scrollToProducts() {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '0 24px' }}>
        <header
          role="banner"
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            aria-label="CaseCellShop — página inicial"
            style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em', color: '#00C8FF' }}
          >
            CaseCellShop
          </span>
        </header>

        <div className="hero-grid" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Left: text */}
          <div>
            <h1
              style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 800,
                margin: '0 0 16px 0',
                lineHeight: '1.15',
                letterSpacing: '-0.02em',
                color: '#f8fafc',
              }}
            >
              CaseCellShop
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#94a3b8', margin: '0 0 32px 0', lineHeight: '1.6' }}>
              Checkout resiliente para e-commerce.
            </p>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 40px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {HIGHLIGHTS.map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.9375rem',
                    color: '#cbd5e1',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: '#00C8FF',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={scrollToProducts}
              aria-label="Ir para a lista de produtos"
              style={{
                padding: '14px 32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#00C8FF',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              Ver Produtos
            </button>
          </div>

          {/* Right: illustration */}
          <div
            className="hero-illustration"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <svg
              viewBox="0 0 400 360"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              style={{ width: '100%', maxWidth: '380px' }}
            >
              <circle cx="200" cy="180" r="140" fill="#00C8FF" fillOpacity="0.05" />
              <circle cx="200" cy="180" r="100" fill="#00C8FF" fillOpacity="0.05" />

              {/* Phone body */}
              <rect x="130" y="50" width="140" height="260" rx="22" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <rect x="138" y="78" width="124" height="196" rx="4" fill="#0f172a" />
              <rect x="138" y="78" width="124" height="196" rx="4" fill="url(#screenGrad)" />

              {/* Buttons */}
              <rect x="270" y="110" width="4" height="30" rx="2" fill="#334155" />
              <rect x="126" y="105" width="4" height="20" rx="2" fill="#334155" />
              <rect x="126" y="132" width="4" height="20" rx="2" fill="#334155" />

              {/* Home indicator */}
              <rect x="174" y="296" width="52" height="4" rx="2" fill="#334155" />

              {/* Camera notch */}
              <circle cx="188" cy="64" r="4" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
              <circle cx="200" cy="62" r="2" fill="#334155" />

              {/* Dashed case outline */}
              <rect x="126" y="46" width="148" height="268" rx="24" fill="none" stroke="#00C8FF" strokeWidth="2.5" strokeDasharray="8 4" opacity="0.4" />

              {/* Shield on screen */}
              <g transform="translate(155, 118)">
                <path
                  d="M45 8 L8 22 L8 52 C8 70 25 83 45 91 C65 83 82 70 82 52 L82 22 Z"
                  fill="#00C8FF"
                  fillOpacity="0.12"
                  stroke="#00C8FF"
                  strokeWidth="2"
                />
                <path
                  d="M32 52 L41 61 L60 40"
                  stroke="#00C8FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              {/* Badge: Estoque */}
              <g transform="translate(18, 82)">
                <rect width="100" height="38" rx="19" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <circle cx="19" cy="19" r="9" fill="#00C8FF" fillOpacity="0.18" />
                <text x="19" y="24" textAnchor="middle" fill="#00C8FF" fontSize="11" fontWeight="700">↑</text>
                <text x="57" y="23" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Estoque</text>
              </g>

              {/* Badge: Seguro */}
              <g transform="translate(278, 200)">
                <rect width="90" height="38" rx="19" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <circle cx="19" cy="19" r="9" fill="#22c55e" fillOpacity="0.18" />
                <text x="19" y="24" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="700">✓</text>
                <text x="51" y="23" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Seguro</text>
              </g>

              {/* Badge: Cache */}
              <g transform="translate(274, 82)">
                <rect width="90" height="38" rx="19" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <circle cx="19" cy="19" r="9" fill="#f97316" fillOpacity="0.18" />
                <text x="19" y="24" textAnchor="middle" fill="#f97316" fontSize="11" fontWeight="700">⚡</text>
                <text x="51" y="23" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Cache</text>
              </g>

              <defs>
                <linearGradient id="screenGrad" x1="138" y1="78" x2="262" y2="274" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00C8FF" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* ── Products ───────────────────────────────────────────────── */}
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

        {!loading && !error && products.length > 0 && (
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

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer
        role="contentinfo"
        style={{ backgroundColor: '#0f172a', color: '#94a3b8', padding: '48px 24px' }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="footer-grid">
            {/* Brand */}
            <div>
              <p
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#00C8FF',
                  margin: '0 0 8px 0',
                }}
              >
                CaseCellShop
              </p>
              <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: '1.6' }}>
                Technical Challenge Project
              </p>
            </div>

            {/* Author */}
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  margin: '0 0 12px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Desenvolvido por
              </p>
              <p
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: '#f1f5f9',
                  margin: '0 0 12px 0',
                  lineHeight: '1.4',
                }}
              >
                Rodrigo Vieira Batista dos Santos
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="https://github.com/SantosRodrigo89"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                  aria-label="GitHub de Rodrigo Vieira (abre em nova aba)"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.03 1.54 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85.004 1.71.115 2.51.337 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.83-2.34 4.68-4.57 4.92.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
                  </svg>
                  GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/rodrigovieirabatistadossantos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-link"
                  aria-label="LinkedIn de Rodrigo Vieira (abre em nova aba)"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                  LinkedIn
                </a>
              </div>
            </div>

            {/* Tech stack */}
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  margin: '0 0 12px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Stack
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TECH_STACK.map((tech) => (
                  <span key={tech} className="stack-badge">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid #1e293b',
              paddingTop: '24px',
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: '#475569',
            }}
          >
            CaseCellShop — Technical Challenge Project
          </div>
        </div>
      </footer>
    </div>
  );
}
