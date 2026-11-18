interface BrandLogoProps {
  subtitle?: string;
}

export function BrandLogo({ subtitle }: BrandLogoProps) {
  return (
    <span className="brand-logo">
      <span className="brand-mark" aria-hidden="true">
        T<span className="brand-mark-x">X</span>
      </span>
      <span>
        <span className="brand-text-vyapar">Vyapar </span>
        <span className="brand-text-taxone">
          Ta<span className="brand-text-x">X</span>One
        </span>
        {subtitle ? (
          <span
            style={{
              display: 'block',
              fontSize: '10.5px',
              fontWeight: 600,
              color: '#64748b',
              letterSpacing: '0.02em',
              marginTop: '-3px',
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
