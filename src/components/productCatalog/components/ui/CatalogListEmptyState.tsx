import { type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface CatalogListEmptyStateProps {
  icon: string;
  name: string;
  description?: string;
  action?: ReactNode;
  title?: string;
}

export function CatalogListEmptyState({
  icon,
  name,
  description,
  action,
  title,
}: CatalogListEmptyStateProps) {
  return (
    <EmptyState
      icon={(
        <span className="material-symbols-rounded" style={{ fontSize: 48, color: 'var(--t3, #9A9084)' }}>
          {icon}
        </span>
      )}
      title={title ?? `No ${name} found`}
      description={description}
      action={action}
    />
  );
}
