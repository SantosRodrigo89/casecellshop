'use client';

const HIGHLIGHTS = [
  'Estoque em tempo real',
  'Proteção contra compras duplicadas',
  'Integração ERP resiliente',
];

export function HeroSection() {
  function scrollToProducts() {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
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
  );
}
