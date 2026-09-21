import React from 'react';
import { AlertCircle, RefreshCw, Database } from 'lucide-react';

export const Skeleton: React.FC<{ width?: string; height?: string; borderRadius?: string }> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-sm)',
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      backgroundColor: 'var(--bg-subtle)',
      animation: 'pulseGlow 1.5s infinite ease-in-out',
    }}
  />
);

export const EmptyState: React.FC<{
  title?: string;
  message: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = 'No Data Found',
  message,
  icon,
  actionText,
  onAction,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--text-secondary)',
    }}
  >
    <div
      style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        color: 'var(--text-muted)',
      }}
    >
      {icon || <Database size={24} />}
    </div>
    <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '6px' }}>{title}</h3>
    <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', marginBottom: actionText ? '16px' : '0' }}>
      {message}
    </p>
    {actionText && onAction && (
      <button onClick={onAction} className="btn btn-secondary btn-sm">
        {actionText}
      </button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({
  message = 'Unable to connect to the AgniDrishti backend service.',
  onRetry,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.04)',
      border: '1px solid var(--color-high-border)',
      borderRadius: 'var(--radius-md)',
      margin: '20px 0',
    }}
  >
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-high-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-high)',
        marginBottom: '14px',
      }}
    >
      <AlertCircle size={24} />
    </div>
    <h3 style={{ fontSize: '15px', color: '#ffffff', marginBottom: '4px' }}>
      Connection Error
    </h3>
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '16px' }}>
      {message}
    </p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-primary btn-sm">
        <RefreshCw size={13} />
        <span>Retry Connection</span>
      </button>
    )}
  </div>
);
