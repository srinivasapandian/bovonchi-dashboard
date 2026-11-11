import type { ReactNode } from 'react';

interface TopBarProps {
  breadcrumbs?: string;
  title?: string;
  titleInfo?: string;
  subtitle?: ReactNode;
  leftAddon?: ReactNode;
  extraContent?: ReactNode;
  onBack?: () => void;
  onExport?: () => void;
  dateFilters?: ReactNode;
  sourceFilters?: ReactNode;
}

/** Page title bar: Cormorant headline, small-caps breadcrumb, page actions on the right. */
export default function TopBar({
  breadcrumbs,
  title,
  titleInfo,
  subtitle,
  leftAddon,
  extraContent,
  onBack,
  onExport,
  dateFilters,
  sourceFilters,
}: TopBarProps) {
  return (
    <header
      style={{
        flexShrink: 0,
        minHeight: 78,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 36px',
        background: 'var(--bv-ivory)',
        borderBottom: '1px solid var(--bv-line)',
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{ border: '1px solid var(--bv-line)', background: 'transparent', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', color: 'var(--bv-ink)' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
            arrow_back
          </span>
        </button>
      )}
      {leftAddon}
      <div style={{ minWidth: 0, flex: 1 }}>
        {breadcrumbs ? (
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--bv-ink-faint)', marginBottom: 2 }}>
            {breadcrumbs}
          </div>
        ) : null}
        <h1
          title={titleInfo}
          style={{
            margin: 0,
            fontFamily: 'var(--bv-font-display)',
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.1,
            color: 'var(--bv-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
        {subtitle ? <div style={{ fontSize: 13, color: 'var(--bv-ink-muted)', marginTop: 2 }}>{subtitle}</div> : null}
      </div>
      {sourceFilters}
      {dateFilters}
      {extraContent}
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          style={{ border: '1px solid var(--bv-ink)', background: 'transparent', padding: '9px 20px', borderRadius: 999, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', color: 'var(--bv-ink)' }}
        >
          Export
        </button>
      )}
    </header>
  );
}
