import type { Product } from '@/types';
import { HeroSection } from '@/components/HeroSection';
import { ProductsSection } from '@/components/ProductsSection';

export const revalidate = 60;

const TECH_STACK = ['Next.js', 'NestJS', 'MongoDB', 'Redis'];

async function getProducts(): Promise<Product[]> {
  const baseUrl =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001/api';

  try {
    const res = await fetch(`${baseUrl}/products`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <HeroSection />

      <ProductsSection initialProducts={products} />

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
                  href="https://www.linkedin.com/in/rodrigo-v-b9ba696a/"
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
