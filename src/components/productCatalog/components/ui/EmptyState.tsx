import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: 16, color: 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon || (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        )}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', margin: '0 0 6px' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 20px', maxWidth: 360, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
