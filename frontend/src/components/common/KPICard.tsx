import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value?: number | string | null;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'high' | 'medium' | 'low' | 'uncertain' | 'brand';
  isLoading?: boolean;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  isLoading = false,
  onClick,
}) => {
  const variantStyles = {
    default: {
      border: 'var(--border-subtle)',
      iconBg: 'rgba(255, 255, 255, 0.05)',
      iconColor: 'var(--text-secondary)',
      valueColor: '#ffffff',
    },
    high: {
      border: 'var(--color-high-border)',
      iconBg: 'var(--color-high-bg)',
      iconColor: 'var(--color-high)',
      valueColor: 'var(--color-high)',
    },
    medium: {
      border: 'var(--color-medium-border)',
      iconBg: 'var(--color-medium-bg)',
      iconColor: 'var(--color-medium)',
      valueColor: 'var(--color-medium)',
    },
    low: {
      border: 'var(--color-low-border)',
      iconBg: 'var(--color-low-bg)',
      iconColor: 'var(--color-low)',
      valueColor: 'var(--color-low)',
    },
    uncertain: {
      border: 'var(--color-uncertain-border)',
      iconBg: 'var(--color-uncertain-bg)',
      iconColor: 'var(--color-uncertain)',
      valueColor: 'var(--color-uncertain)',
    },
    brand: {
      border: 'rgba(255, 87, 34, 0.35)',
      iconBg: 'rgba(255, 87, 34, 0.12)',
      iconColor: 'var(--brand-primary)',
      valueColor: '#ffffff',
    },
  }[variant];

  const displayValue = isLoading ? '...' : (value !== undefined && value !== null ? value : '—');

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderColor: variantStyles.border,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: variantStyles.valueColor,
            lineHeight: 1.1,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {displayValue}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div
        style={{
          width: '46px',
          height: '46px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: variantStyles.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={variantStyles.iconColor} />
      </div>
    </div>
  );
};
